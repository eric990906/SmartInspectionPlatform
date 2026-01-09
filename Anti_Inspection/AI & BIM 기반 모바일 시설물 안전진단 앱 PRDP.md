🏗️ AI & BIM 기반 모바일 시설물 안전진단 앱 PRDProject Name: Smart Safety Inspection PrototypeVersion: 1.2Date: 2026-01-09Status: In Progress (Prototyping)1. 개요 (Overview)1.1 배경 및 목적기존의 무거운 모바일 BIM 뷰어의 한계를 극복하기 위해, **SVG(2D 벡터)와 JSON(속성)**을 활용한 경량화된 안전진단 앱을 구축한다. 현장 작업자의 동선을 고려하여 "촬영 우선(Shoot-First)" 워크플로우를 적용, 빠르고 직관적인 점검 환경을 제공한다.1.2 핵심 가치Zero Latency: SVG 기반으로 렉 없는 도면 조작 (Zoom/Pan).Context Aware: 도면 객체(SVG ID)와 데이터(JSON)의 즉각적인 연동.Field-Centric UX: "마커 생성 → 카메라 촬영 → 수치 입력"의 현장 친화적 프로세스.2. 유저 시나리오 (User Flow)현장 안전 진단 엔지니어의 작업 흐름을 정의한다.graph TD
    Start[앱 실행 & 도면 로드] --> ViewMode[뷰 모드 (View Mode)]
    
    subgraph "1. 정보 확인 (Inspection Check)"
        ViewMode -->|기존 마커/객체 클릭| InfoPopup[속성 정보 팝업]
        InfoPopup -->|이력 확인| History[과거 점검 이력 리스트]
        InfoPopup -->|닫기| ViewMode
    end

    subgraph "2. 점검 및 하자 등록 (Inspection & Defect)"
        ViewMode -->|점검 모드 토글 ON| EditMode[생성 모드 활성화]
        EditMode -->|도면상 위치 터치| Camera[카메라 실행 (전체화면)]
        Camera -->|사진 촬영| Preview[촬영 결과 확인]
        Preview -->|재촬영| Camera
        Preview -->|사진 확정| InputModal[수치/정보 입력]
        
        InputModal -->|탭 1| TextInput[텍스트/키패드 입력]
        InputModal -->|탭 2| DrawingInput[사진 위 드로잉/메모]
        
        TextInput -->|저장| Save[데이터 저장 & 마커 생성]
        DrawingInput -->|저장| Save
        Save --> ViewMode
    end
3. 상세 기능 명세 (Functional Requirements)3.1 도면 뷰어 (Map Viewer)ID기능명상세 내용기술 스택/라이브러리FE-01SVG 렌더링office_plan.svg 파일을 인라인 컴포넌트로 렌더링하여 각 path/g 태그의 ID 접근을 허용함.SVG Inline ComponentFE-02줌/팬 제어모바일 제스처(Pinch Zoom, Drag)를 통한 부드러운 확대/축소/이동 지원.react-zoom-pan-pinchFE-03객체 하이라이팅점검 상태(Safe, Defect, Not_Inspected)에 따라 객체 색상(Fill Color) 동적 변경.CSS / State MappingFE-04좌표 보정줌 상태에서 클릭 시, 화면 좌표(ClientX,Y)를 SVG 내부 좌표(Relative X,Y)로 정확히 변환하여 마커 표시.Context Transformation3.2 점검 및 데이터 입력 (Inspection Workflow)ID기능명상세 내용기술 스택/라이브러리FE-05카메라 실행마커 생성 시 즉시 전면 카메라 모듈 실행 (PC 환경 고려하여 예외처리 필수).react-webcamFE-06이미지 캡처촬영된 이미지를 Base64 스트링으로 임시 저장 및 미리보기 제공.Canvas APIFE-07드로잉 입력캡처된 이미지 위에 손가락/펜으로 마킹(Crack 표시 등) 기능 제공.react-canvas-draw (or signature_pad)FE-08데이터 매핑신규 생성된 하자 정보를 선택된 부재 ID(Col-C1 등)의 inspection_history 배열에 추가.State Management3.3 정보 조회 (Info Viewer)ID기능명상세 내용FE-09속성 팝업부재 클릭 시 attributes.json에서 해당 ID를 조회하여 기본 정보(재질, 규격) 표시.FE-10이력 리스트inspection_history 배열이 있을 경우, 날짜별 점검 이력을 리스트 형태로 렌더링.FE-11상태 시각화점검 결과가 없는 경우 "이력 없음" UI, 하자가 있는 경우 "⚠️ 하자 발견" 배지 표시.4. 데이터 구조 (Data Schema)attributes.json 파일의 표준 스키마 정의.{
  "elements": [
    {
      "element_id": "Col-C1",  // SVG 태그의 ID와 일치해야 함
      "category": "Column",
      "name": "C1 기둥",
      
      // [Static] 변하지 않는 정보
      "static_info": {
        "material": "RC",
        "spec": "500x500"
      },
      
      // [Dynamic] 점검 이력 (Array)
      "inspection_history": [
        {
          "inspection_id": "insp_001",
          "date": "2026-01-09",
          "inspector": "User_A",
          "status": "Defect", // Safe | Defect
          "photo_url": "base64_string...",
          "drawing_data": "json_string...",
          "text_comment": "0.3mm 균열 발생"
        }
      ],
      
      // [Display] 현재 상태 (마지막 점검 기준)
      "current_status": "Defect" 
    }
  ]
}
5. 기술 스택 및 환경 (Tech Stack)Frontend Framework: React 18+Build Tool: Vite (빠른 HMR 지원)Language: TypeScript (엄격한 데이터 타입 관리)Core Libraries:react-zoom-pan-pinch: 도면 제어react-webcam: 카메라 기능react-canvas-draw: 이미지 위 드로잉lucide-react: UI 아이콘Styling: CSS Modules 또는 Tailwind CSS (권장)6. 개발 우선순위 (Milestones)Phase 1 (도면 연동): office_plan.svg 띄우기 및 줌/팬 구현, 클릭 시 ID 콘솔 출력.Phase 2 (데이터 뷰어): 클릭한 ID로 attributes.json 데이터 매핑하여 팝업 띄우기.Phase 3 (입력 로직): 카메라 촬영 → 이미지 저장 → 수치 입력 → JSON 업데이트 흐름 완성.Phase 4 (시각화): 업데이트된 JSON 상태(Safe/Defect)에 따라 SVG 색상 변경.