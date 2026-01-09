import { useState, useRef, useCallback, useEffect } from "react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import Webcam from "react-webcam";
import CanvasDraw from "react-canvas-draw";
import { Camera, Check, Pen, Save, X, RotateCcw, Image as ImageIcon, FileText, List } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppStore } from "./lib/store";
import { Marker } from "./lib/types";

// --- Types ---
type WorkflowStep = 'IDLE' | 'CAMERA' | 'PREVIEW' | 'INPUT';

// --- Data Manager (Minimal) ---
const fetchPlan = async () => {
  const res = await fetch("/plans/office_plan.svg"); // Ensure this path exists
  if (!res.ok) throw new Error("Failed to load plan");
  return res.text();
};

// --- Main Component ---
export default function App() {
  // Global State (Persisted)
  const { mode, setMode, markers, addMarker } = useAppStore();

  // Local UI State
  const [workflow, setWorkflow] = useState<WorkflowStep>('IDLE');
  const [isPlacing, setIsPlacing] = useState(false);
  const [isListOpen, setIsListOpen] = useState(false); // List Modal State

  // Temp Data for new Marker
  const [tempData, setTempData] = useState<Partial<Marker>>({});

  // Refs
  const webcamRef = useRef<Webcam>(null);
  const canvasRef = useRef<CanvasDraw>(null);
  const svgRef = useRef<SVGSVGElement>(null); // Reference to the OVERLAY SVG

  // Data Query
  const { data: svgString } = useQuery({
    queryKey: ['plan'],
    queryFn: fetchPlan
  });

  // --- Logic: Coordinate Mapping ---
  // Calculates SVG coordinates from Screen Click
  const handleMapClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode !== 'INSPECT' || workflow !== 'IDLE') return;
    if (!isPlacing) return; // Only allow placement if explicit mode is on
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

    // 3. Proceed to Workflow
    setTempData({ x: svgPoint.x, y: svgPoint.y });
    setIsPlacing(false); // Reset placing mode immediately
    setWorkflow('CAMERA');
  };

  // --- Logic: Camera ---
  const capturePhoto = useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setTempData(prev => ({ ...prev, photoUrl: imageSrc }));
        setWorkflow('PREVIEW');
      }
    }
  }, [webcamRef]);

  // --- Logic: Save ---
  const saveMarker = () => {
    // Get Drawing Data
    let drawingData = "";
    if (canvasRef.current) {
      drawingData = canvasRef.current.getSaveData();
    }

    const newMarker: Marker = {
      id: Date.now(),
      x: tempData.x || 0,
      y: tempData.y || 0,
      photoUrl: tempData.photoUrl || "",
      textValue: tempData.textValue || "",
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

  // 1. Camera View
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
          {/* Guides */}
          <div className="absolute inset-0 border-[50px] border-black/30 pointer-events-none" />
          <button
            onClick={() => setWorkflow('IDLE')}
            className="absolute top-4 right-4 text-white bg-black/50 p-2 rounded-full"
          >
            <X />
          </button>
        </div>
        <div className="h-32 bg-black flex items-center justify-center space-x-8">
          <button
            onClick={capturePhoto}
            className="w-20 h-20 bg-white rounded-full border-4 border-gray-300 active:scale-95 transition-transform"
          />
        </div>
      </div>
    );
  }

  // 2. Preview View
  if (workflow === 'PREVIEW') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex-1 relative">
          {tempData.photoUrl && <img src={tempData.photoUrl} className="w-full h-full object-contain" />}
        </div>
        <div className="h-20 bg-gray-900 flex items-center justify-around">
          <button
            onClick={() => setWorkflow('CAMERA')}
            className="flex items-center text-white gap-2 px-4 py-2 rounded-lg hover:bg-white/10"
          >
            <RotateCcw size={20} /> 재촬영
          </button>
          <button
            onClick={() => setWorkflow('INPUT')}
            className="flex items-center bg-blue-600 text-white gap-2 px-6 py-2 rounded-lg font-bold"
          >
            <Check size={20} /> 확인
          </button>
        </div>
      </div>
    )
  }

  // 3. Input Modal (Using Tabs)
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

  // 4. Main Plan View
  return (
    <div className="flex flex-col h-[100dvh] w-full bg-gray-100 overflow-hidden">
      {/* Header */}
      <div className="h-14 bg-white shadow-sm flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-gray-800">시설물 안전진단</h1>
          <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-500">v0.2</span>
        </div>

        <div className="flex items-center gap-2">
          {/* List Button */}
          <button
            onClick={() => setIsListOpen(true)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-full"
          >
            <List size={22} />
          </button>

          {/* Mode Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setMode('INSPECT')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'INSPECT' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500'}`}
            >
              점검
            </button>
            <button
              onClick={() => setMode('REVIEW')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${mode === 'REVIEW' ? 'bg-green-600 text-white shadow-sm' : 'text-gray-500'}`}
            >
              확인
            </button>
          </div>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden bg-gray-200">
        <TransformWrapper
          panning={{ disabled: false }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent wrapperStyle={{ width: "100%", height: "100%" }} contentStyle={{ width: "100%", height: "100%" }}>
            <div className="relative w-full h-full min-h-[50vh]">
              {/* Background SVG */}
              <div
                className="absolute inset-0 pointer-events-none"
                dangerouslySetInnerHTML={{ __html: svgString || "" }}
                style={{ width: "100%", height: "100%", opacity: 0.8 }}
              />

              {/* Interactive Overlay & Markers */}
              <svg
                ref={svgRef}
                viewBox="0 0 800 600"
                className="absolute inset-0 w-full h-full"
                style={{
                  cursor: mode === 'REVIEW' ? 'auto' : (isPlacing ? 'crosshair' : 'grab'),
                  pointerEvents: 'auto'
                }}
                onClick={handleMapClick}
                preserveAspectRatio="xMidYMid meet"
              >
                {markers.map(m => (
                  <g
                    key={m.id}
                    transform={`translate(${m.x}, ${m.y})`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (mode === 'REVIEW') setSelectedMarker(m);
                    }}
                    style={{ cursor: mode === 'REVIEW' ? 'pointer' : 'default' }}
                  >
                    <circle r="15" fill={mode === 'REVIEW' ? "#10b981" : "#ef4444"} fillOpacity="0.8" stroke="white" strokeWidth="3" />
                    <text y="-20" textAnchor="middle" fill="black" fontSize="12" fontWeight="bold">NO.{m.id.toString().slice(-4)}</text>
                  </g>
                ))}
              </svg>
            </div>
          </TransformComponent>
        </TransformWrapper>

        {/* Floating Action Button (Top 30% Right) */}
        {mode === 'INSPECT' && workflow === 'IDLE' && (
          <div className="absolute right-4 w-auto z-20 flex flex-col items-end gap-2" style={{ top: '30%' }}>
            {isPlacing && (
              <div className="bg-black/70 text-white px-3 py-1 rounded-md text-sm mb-1 animate-pulse">
                도면을 터치하여 마커 배치
              </div>
            )}
            <button
              onClick={() => setIsPlacing(!isPlacing)}
              className={`flex items-center gap-2 px-5 py-3 rounded-full shadow-lg font-bold transition-all active:scale-95 ${isPlacing
                ? "bg-red-500 text-white"
                : "bg-blue-600 text-white"
                }`}
            >
              {isPlacing ? <X size={20} /> : <Pen size={20} />}
              {isPlacing ? "취소" : "마커 생성"}
            </button>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {selectedMarker && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setSelectedMarker(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold">마커 상세정보</h3>
              <button onClick={() => setSelectedMarker(null)}><X /></button>
            </div>
            <div className="p-4 space-y-4">
              {selectedMarker.photoUrl && (
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img src={selectedMarker.photoUrl} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-500">텍스트 입력값</p>
                <p className="text-gray-800">{selectedMarker.textValue || "입력 없음"}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm font-bold text-gray-500 mb-2">스케치</p>
                <div className="border bg-white h-48 relative">
                  <CanvasDraw
                    disabled
                    hideGrid
                    immediateLoading
                    saveData={selectedMarker.drawingData}
                    canvasWidth={300}
                    canvasHeight={200}
                    loadTimeOffset={0}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-400">ID: {selectedMarker.id}</p>
            </div>
          </div>
        </div>
      )}

      {/* List Modal */}
      {isListOpen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col animate-in slide-in-from-bottom-5">
          <div className="p-4 border-b flex justify-between items-center shadow-sm">
            <h2 className="font-bold text-lg">점검 목록 ({markers.length})</h2>
            <button onClick={() => setIsListOpen(false)} className="p-2 bg-gray-100 rounded-full"><X /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {markers.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <FileText size={48} className="mb-4 opacity-50" />
                <p>등록된 점검 데이터가 없습니다.</p>
              </div>
            )}
            {markers.map(m => (
              <div
                key={m.id}
                className="bg-white p-3 rounded-lg border shadow-sm flex gap-4 active:bg-gray-50"
                onClick={() => {
                  setSelectedMarker(m);
                  setIsListOpen(false);
                  setMode('REVIEW');
                }}
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 bg-gray-200 rounded-md shrink-0 overflow-hidden">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400"><ImageIcon size={20} /></div>
                  )}
                </div>
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-blue-600">NO.{m.id.toString().slice(-4)}</span>
                    <span className="text-xs text-gray-400">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {m.textValue || "(텍스트 입력 없음)"}
                  </p>
                  <div className="mt-2 flex gap-2">
                    {m.drawingData && <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">스케치 있음</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Sub-Component: Input Modal ---
function InputModal({ tempData, setTempData, onSave, onCancel, canvasRef }: any) {
  const [tab, setTab] = useState<'TEXT' | 'DRAWING'>('TEXT');

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]">

        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center shrink-0">
          <h2 className="font-bold text-lg">점검 내용 입력</h2>
          <button onClick={onCancel} className="p-2 bg-gray-100 rounded-full"><X size={18} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b shrink-0">
          <button
            onClick={() => setTab('TEXT')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 ${tab === 'TEXT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
          >
            <FileText size={16} /> 텍스트
          </button>
          <button
            onClick={() => setTab('DRAWING')}
            className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 border-b-2 ${tab === 'DRAWING' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400'}`}
          >
            <Pen size={16} /> 드로잉
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
          {tab === 'TEXT' && (
            <div className="space-y-4">
              <label className="block text-sm font-bold text-gray-700">결함 상세 내용</label>
              <textarea
                className="w-full h-40 p-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="내용을 입력하세요..."
                value={tempData.textValue || ""}
                onChange={(e) => setTempData({ ...tempData, textValue: e.target.value })}
              />
            </div>
          )}

          {tab === 'DRAWING' && (
            <div className="flex flex-col items-center">
              <label className="block text-sm font-bold text-gray-700 mb-2 w-full">손글씨 / 스케치</label>
              <div className="border border-gray-300 bg-white shadow-sm overflow-hidden touch-none relative" style={{ width: '100%', height: '300px' }}>
                <CanvasDraw
                  ref={canvasRef}
                  brushColor="#000000"
                  brushRadius={2}
                  lazyRadius={0}
                  canvasWidth={400} // Force enough size
                  canvasHeight={300}
                  className="touch-none"
                />
              </div>
              <button
                onClick={() => canvasRef.current?.clear()}
                className="mt-2 text-sm text-red-500 underline"
              >
                지우기
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-white shrink-0">
          <button
            onClick={onSave}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Save size={18} /> 저장하기
          </button>
        </div>
      </div>
    </div>
  )
}
