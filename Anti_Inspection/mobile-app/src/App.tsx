import { useState, useRef, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Webcam from "react-webcam";
import CanvasDraw from "react-canvas-draw";
import { Camera, Check, Pen, Save, X, RotateCcw, Image as ImageIcon, FileText, List, Info, Trash2, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "./lib/store";
import type { Marker } from "./lib/types";

// --- Types ---
type WorkflowStep = 'IDLE' | 'CAMERA' | 'PREVIEW' | 'INPUT';

interface AttributeData {
  project_info: any;
  elements: any[];
}

// --- Data Manager (Minimal) ---
const fetchPlan = async () => {
  const res = await fetch("/plans/office_plan.svg");
  if (!res.ok) throw new Error("Failed to load plan");
  return res.text();
};

const fetchAttributes = async () => {
  const res = await fetch("/plans/attributes.json");
  if (!res.ok) throw new Error("Failed to load attributes");
  return res.json() as Promise<AttributeData>;
};

// --- Main Component ---
export default function App() {
  // Global State (Persisted)
  const { mode, setMode, markers, addMarker, removeMarker } = useAppStore();

  // Local UI State
  const [workflow, setWorkflow] = useState<WorkflowStep>('IDLE');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false);

  // Temp Data for new Marker (Extended with BIM info)
  const [tempData, setTempData] = useState<Partial<Marker> & { elementId?: string, elementData?: any }>({});

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<CanvasDraw>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Data Query
  const { data: svgString } = useQuery({ queryKey: ['plan'], queryFn: fetchPlan });
  const { data: attributes } = useQuery({ queryKey: ['attributes'], queryFn: fetchAttributes });

  // --- Logic: Coordinate Mapping & Hit Test ---
  const handleMapClick = (e: React.MouseEvent | React.TouchEvent) => {
    // If user is trying to click a marker (Review Mode) or just exploring, we might want to allow it.
    // But this function specifically handles NEW MARKER creation logic.
    // If not in INSPECT, we ignore map clicks for creation.
    if (mode !== 'INSPECT' || workflow !== 'IDLE') return;

    // Explicit placement mode check
    if (!isPlacing) return;

    if (!svgRef.current) return;

    // 1. Get client coordinates
    let clientX, clientY;
    if ('touches' in e.nativeEvent) {
      const touch = (e.nativeEvent as TouchEvent).touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    // 2. SVG Math
    const svg = svgRef.current;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;

    const screenCTM = svg.getScreenCTM();
    if (!screenCTM) return;

    const svgPoint = point.matrixTransform(screenCTM.inverse());

    // 3. BIM Element Hit Test
    // Temporarily hide the overlay to find what's underneath
    const originalDisplay = svg.style.display;
    svg.style.display = 'none';
    const hitElements = document.elementsFromPoint(clientX, clientY);
    svg.style.display = originalDisplay;

    let foundElementId = null;
    let foundElementData = null;

    // Look for elements with IDs in our attributes list
    if (attributes?.elements) {
      for (const el of hitElements) {
        const id = el.id;
        // Check direct match
        if (id && attributes.elements.find((item: any) => item.element_id === id)) {
          foundElementId = id;
          foundElementData = attributes.elements.find((item: any) => item.element_id === id);
          break;
        }
        // Check closest group (common in SVGs)
        const closestG = el.closest('g');
        if (closestG && closestG.id && attributes.elements.find((item: any) => item.element_id === closestG.id)) {
          foundElementId = closestG.id;
          foundElementData = attributes.elements.find((item: any) => item.element_id === closestG.id);
          break;
        }
      }
    }

    if (foundElementId) {
      console.log("BIM Element Found:", foundElementId, foundElementData);
    } else {
      console.log("No BIM Element Found at this location");
    }

    // 4. Proceed to Workflow
    setTempData({
      x: svgPoint.x,
      y: svgPoint.y,
      elementId: foundElementId || undefined,
      elementData: foundElementData
    });
    setIsPlacing(false);
    setWorkflow('CAMERA');
  };

  // --- Logic: Camera ---
  const capturePhoto = useCallback(() => {
    // [TEST MODE] Use specific crack image for AI testing
    const imageSrc = "/crack_sample.jpg";
    setTempData(prev => ({ ...prev, photoUrl: imageSrc }));
    setWorkflow('PREVIEW');

    /* 
    // Original Webcam Logic
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setTempData(prev => ({ ...prev, photoUrl: imageSrc }));
        setWorkflow('PREVIEW');
      }
    }
    */
  }, [webcamRef]);

  // --- Logic: Save ---
  const saveMarker = () => {
    let drawingData = "";
    if (canvasRef.current) {
      drawingData = canvasRef.current.getSaveData();
    }

    let bimInfo = "";
    if (tempData.elementData) {
      bimInfo = `\n\n[BIM Info]\nID: ${tempData.elementData.element_id}\nName: ${tempData.elementData.name}\nLevel: ${tempData.elementData.category}`;
    }

    const newMarker: Marker = {
      id: Date.now(),
      x: tempData.x || 0,
      y: tempData.y || 0,
      photoUrl: tempData.photoUrl || "",
      textValue: (tempData.textValue || "") + bimInfo,
      drawingData: drawingData,
      createdAt: Date.now()
    };

    addMarker(newMarker);
    setWorkflow('IDLE');
    setTempData({});
  };

  // --- Logic: Review ---
  const [selectedMarker, setSelectedMarker] = useState<Marker | null>(null);

  // --- Renders ---
  if (workflow === 'CAMERA') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{ facingMode: "environment" }}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 border-[50px] border-black/30 pointer-events-none" />
          {/* BIM Info Overlay */}
          {tempData.elementData && (
            <div className="absolute top-4 left-4 right-16 bg-black/60 text-white p-3 rounded-lg backdrop-blur-sm pointer-events-none z-50">
              <div className="flex items-center gap-2 mb-1">
                <Info size={16} className="text-blue-400" />
                <span className="font-bold text-sm">{tempData.elementData.element_id}</span>
              </div>
              <div className="text-xs opacity-90">{tempData.elementData.name}</div>
            </div>
          )}
          <button
            onClick={() => setWorkflow('IDLE')}
            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full"
          >
            <X />
          </button>
        </div>
        <div className="h-32 bg-black flex items-center justify-center space-x-8">
          <button onClick={capturePhoto} className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 active:scale-95 transition-transform" />
        </div>
      </div>
    );
  }

  if (workflow === 'PREVIEW') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative">
          {tempData.photoUrl && <img src={tempData.photoUrl} className="w-full h-full object-contain" />}
        </div>
        <div className="h-20 bg-gray-900 flex items-center justify-around">
          <button onClick={() => setWorkflow('CAMERA')} className="flex items-center text-white gap-2 px-4 py-2 rounded-lg hover:bg-white/10">
            <RotateCcw size={20} /> 재촬영
          </button>
          <button onClick={() => setWorkflow('INPUT')} className="flex items-center bg-blue-600 text-white gap-2 px-6 py-2 rounded-lg font-bold">
            <Check size={20} /> 확인
          </button>
        </div>
      </div>
    )
  }

  if (workflow === 'INPUT') {
    return (
      <InputModal
        tempData={tempData}
        setTempData={setTempData}
        onSave={saveMarker}
        onCancel={() => setWorkflow('IDLE')}
        canvasRef={canvasRef}
      />
    )
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-100 overflow-hidden">
      <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-gray-800">시설물 안전진단</h1>
          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-500">v0.2</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsListOpen(true)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"><List size={22} /></button>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setMode('INSPECT')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'INSPECT' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}>점검</button>
            <button onClick={() => setMode('REVIEW')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'REVIEW' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500'}`}>확인</button>
          </div>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-gray-200">
        <TransformWrapper panning={{ disabled: false }} doubleClick={{ disabled: true }}>
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
            <div className="relative w-full h-full min-h-[50vh]">
              {/* NOTE: Removed pointer-events-none here to allow hit-testing by document.elementsFromPoint */}
              <div
                className="absolute inset-0"
                dangerouslySetInnerHTML={{ __html: svgString || "" }}
                style={{ width: "100%", height: "100%", opacity: 0.8 }}
              />
              <svg
                ref={svgRef}
                viewBox="0 0 800 600"
                className="absolute inset-0 w-full h-full"
                style={{ cursor: mode === 'REVIEW' ? 'auto' : (isPlacing ? 'crosshair' : 'grab'), pointerEvents: 'auto' }}
                onClick={handleMapClick}
                preserveAspectRatio="xMidYMid meet"
              >
                {markers.map(m => (
                  <g
                    key={m.id}
                    transform={`translate(${m.x}, ${m.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      // Always allow opening the details, even in Inspect mode. 
                      // It's friendlier UX. Just verify mode switch if needed.
                      setSelectedMarker(m);
                      setMode('REVIEW');
                    }}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle r="15" fill={mode === 'REVIEW' ? "#10b981" : "#ef4444"} fillOpacity="0.8" stroke="white" strokeWidth="3" />
                    <text y="-20" textAnchor="middle" fill="black" fontSize="12" fontWeight="bold">NO.{m.id.toString().slice(-4)}</text>
                  </g>
                ))}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>

        {mode === 'INSPECT' && workflow === 'IDLE' && (
          <div className="absolute right-4 w-auto z-20 flex flex-col items-end gap-2" style={{ top: '30%' }}>
            {isPlacing && <div className="bg-black/70 text-white px-3 py-1 rounded-md text-sm mb-1 animate-pulse">도면을 터치하여 마커 배치</div>}
            <button onClick={() => setIsPlacing(!isPlacing)} className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-bold transition-all active:scale-95 ${isPlacing ? "bg-red-500 text-white" : "bg-blue-600 text-white"}`}>
              {isPlacing ? <X size={20} /> : <Pen size={20} />} {isPlacing ? "취소" : "마커 생성"}
            </button>
          </div>
        )}
      </div>

      {selectedMarker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedMarker(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">마커 상세정보</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (confirm("정말 이 마커를 삭제하시겠습니까? (복구 불가)")) {
                      removeMarker(selectedMarker.id);
                      setSelectedMarker(null);
                    }
                  }}
                  className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100"
                >
                  <Trash2 size={20} />
                </button>
                <button onClick={() => setSelectedMarker(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"><X size={20} /></button>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {selectedMarker.photoUrl && <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden"><img src={selectedMarker.photoUrl} className="w-full h-full object-cover" /></div>}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-500">텍스트 입력값</p>
                <div className="text-gray-800 whitespace-pre-line">{selectedMarker.textValue || "입력 없음"}</div>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-500 mb-2">스케치</p>
                <div className="border bg-white h-48 relative"><CanvasDraw disabled hideGrid immediateLoading saveData={selectedMarker.drawingData} canvasWidth={300} canvasHeight={200} loadTimeOffset={0} /></div>
              </div>
              <p className="text-xs text-gray-400">ID: {selectedMarker.id}</p>
            </div>
          </div>
        </div>
      )}

      {isListOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-5">
          <div className="p-4 border-b flex justify-between items-center shadow-sm">
            <h2 className="font-bold text-lg">점검 목록 ({markers.length})</h2>
            <button onClick={() => setIsListOpen(false)} className="p-2 bg-gray-100 rounded-full"><X /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {markers.length === 0 && <div className="flex flex-col items-center justify-center h-full text-gray-400"><FileText size={48} className="mb-4 opacity-50" /><p>등록된 점검 데이터가 없습니다.</p></div>}
            {markers.map(m => (
              <div key={m.id} className="bg-white p-3 rounded-lg border shadow-sm flex gap-4 active:bg-gray-50" onClick={() => { setSelectedMarker(m); setIsListOpen(false); setMode('REVIEW'); }}>
                <div className="w-20 h-20 bg-gray-200 rounded-md shrink-0 overflow-hidden">{m.photoUrl ? <img src={m.photoUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={20} /></div>}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1"><span className="font-bold text-blue-600">NO.{m.id.toString().slice(-4)}</span><span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</span></div>
                  <p className="text-sm text-gray-600 line-clamp-2">{m.textValue || "(텍스트 입력 없음)"}</p>
                  <div className="mt-2 flex gap-2">{m.drawingData && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">스케치 있음</span>}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Real AI Logic (Connected to Backend) ---
const analyzeDefectImage = async (photoUrl: string, text: string, bimInfo: any): Promise<{ defectType: string, metrics: any } | null> => {
  try {
    // 1. Convert Base64 to Blob
    const res = await fetch(photoUrl);
    const blob = await res.blob();
    const file = new File([blob], "defect.jpg", { type: "image/jpeg" });

    // 2. Prepare FormData
    const formData = new FormData();
    formData.append("image", file);
    formData.append("user_input", text);
    formData.append("bim_info", JSON.stringify(bimInfo || {}));

    // 3. Call FastAPI Server (Via Proxy)
    // Note: User must run 'python backend/main.py' for this to work
    const response = await fetch("/api/analyze", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error("Server Error");
    return await response.json();

  } catch (error) {
    console.error("AI Server Error:", error);
    alert("AI 서버 연결 실패! (backend/main.py 실행 여부를 확인하세요)\n임시 시뮬레이션 모드로 전환합니다.");

    // Fallback Code (Simulation)
    await new Promise(r => setTimeout(r, 1000));
    return { defectType: 'CRACK', metrics: { width: 0.3, length: 500 } }; // Fallback
  }
};

function InputModal({ tempData, setTempData, onSave, onCancel, canvasRef }: any) {
  const [tab, setTab] = useState<'TEXT' | 'DRAWING'>('TEXT');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ defectType: string, metrics: any } | null>(null);

  const hasBimData = !!tempData.elementData;

  const handleAnalyze = async () => {
    if (!tempData.textValue || !tempData.photoUrl) {
      alert("사진과 텍스트가 모두 필요합니다.");
      return;
    }
    setIsAnalyzing(true);
    setAiResult(null);

    try {
      const result = await analyzeDefectImage(tempData.photoUrl, tempData.textValue, tempData.elementData);
      setAiResult(result);
      if (result) {
        setTempData((prev: any) => ({
          ...prev,
          defectType: result.defectType,
          metrics: result.metrics
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg">점검 내용 입력</h2>
          <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full"><X size={18} /></button>
        </div>

        {/* BIM Data Info Box */}
        {hasBimData && (
          <div className="px-4 pt-4 pb-0">
            <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-start gap-3">
              <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
              <div>
                <p className="text-sm font-bold text-blue-900">{tempData.elementData.element_id} ({tempData.elementData.category})</p>
                <p className="text-xs text-blue-700 mt-1">{tempData.elementData.name}</p>
                <p className="text-xs text-blue-500 mt-0.5">자재: {tempData.elementData.static_info?.material || '-'}</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Result Card */}
        {aiResult && (
          <div className="px-4 pt-4 pb-0 animate-in slide-in-from-top-2 fade-in">
            <div className="bg-purple-50 border border-purple-100 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full font-bold">AI 분석 완료</span>
                <span className="text-purple-900 font-bold text-sm">{aiResult.defectType}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                {Object.entries(aiResult.metrics).map(([key, val]) => (
                  <div key={key} className="bg-white px-2 py-1 rounded border overflow-hidden">
                    <span className="text-gray-500 text-xs uppercase mr-1">{key}:</span>
                    <span className="font-bold">{String(val)}</span>
                  </div>
                ))}
                {Object.keys(aiResult.metrics).length === 0 && <span className="text-gray-400 text-xs">추출된 수치 없음</span>}
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b shrink-0 mt-2">
          <button onClick={() => setTab('TEXT')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 ${tab === 'TEXT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}><FileText size={16} /> 텍스트</button>
          <button onClick={() => setTab('DRAWING')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 ${tab === 'DRAWING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}><Pen size={16} /> 드로잉</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {tab === 'TEXT' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">결함 상세 내용</label>
              <div className="relative">
                <textarea className="w-full h-40 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none" placeholder="예: 0.3/500 (폭/길이)..." value={tempData.textValue || ""} onChange={(e) => setTempData({ ...tempData, textValue: e.target.value })} />
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !tempData.textValue}
                  className="absolute bottom-3 right-3 bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 transition-all hover:bg-black active:scale-95"
                >
                  {isAnalyzing ? (
                    <>
                      <RotateCcw className="animate-spin" size={12} /> 분석 중...
                    </>
                  ) : (
                    <>
                      <Zap size={12} className="text-yellow-400 fill-yellow-400" /> AI 분석
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-right">Tip: "0.3/500" 입력 시 자동 파싱</p>
            </div>
          )}
          {tab === 'DRAWING' && (
            <div className="flex flex-col items-center">
              <label className="block text-sm font-bold text-gray-700 mb-2 w-full">손글씨 / 스케치</label>
              <div className="border border-gray-300 bg-white shadow-sm overflow-hidden touch-none relative" style={{ width: '100%', height: '300px' }}>
                <CanvasDraw ref={canvasRef} brushColor="#000000" brushRadius={2} lazyRadius={0} canvasWidth={400} canvasHeight={300} className="touch-none" />
              </div>
              <button onClick={() => canvasRef.current?.clear()} className="mt-2 text-sm text-red-500 underline">지우기</button>
            </div>
          )}
        </div>
        <div className="p-4 border-t bg-white shrink-0">
          <button onClick={onSave} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"><Save size={18} /> 저장하기</button>
        </div>
      </div>
    </div>
  )
}
