# 현장 안전 진단 앱 Todo List

이 Todo 리스트는 `infrastructure_safety_platform_spec_ver2.md`의 2.2절(모바일 앱)을 바탕으로 작성되었습니다.
목표 기술 스택: React + Vite + TypeScript (PWA) - 기획서 섹션 5 준수.

## 1. 프로젝트 초기화 및 설정
- [ ] **프로젝트 초기화**
    - [ ] Vite 프로젝트 생성 (`npm create vite@latest . -- --template react-ts`)
    - [ ] 의존성 설치: `tailwindcss`, `postcss`, `autoprefixer`, `lucide-react`, `clsx`, `tailwind-merge` (shadcn-ui 유틸).
    - [ ] PWA 설정: `manifest.json` 구성 (아이콘, 스탠드얼론 디스플레이, 테마 컬러).
    - [ ] 모바일 뷰포트 메타 태그 설정 (줌 방지, safe-area-inset).
- [ ] **디자인 시스템 설정**
    - [ ] `shadcn-ui` 초기화 (또는 필요한 기본 컴포넌트 수동 구성: BottomSheet, Button, Dialog).
    - [ ] 색상 팔레트 정의 (`globals.css` - Primary, Secondary, Destructive, Muted).
    - [ ] 레이아웃 컴포넌트 작성 (모바일 컨테이너, Safe Area 처리).

## 2. 데이터 및 에셋 로딩 (PoC 범위)
- [ ] **샘플 에셋 로드**
    - [ ] `sample_plan` 폴더의 `office_plan.svg`와 `attributes.json`을 `public/assets/`로 복사.
    - [ ] `DataManager` 서비스/훅 생성 (파일 fetch 및 파싱).
    - [ ] **JSON 파싱**: BIM 속성(Attributes)에 대한 상세 타입 정의.
    - [ ] **SVG 파싱**: SVG 내부의 Element ID가 JSON의 `element_id`와 일치하는지 확인.

## 3. 핵심 기능: SVG 뷰어 (Zero-Depth)
- [ ] **인터랙티브 뷰어 구현**
    - [ ] `react-zoom-pan-pinch` (또는 유사 라이브러리) 설치.
    - [ ] `PlanViewer` 컴포넌트 구현 (SVG 렌더링).
    - [ ] 팬(Pan), 줌(Zoom), 더블 탭 초기화 기능 구현.
    - [ ] 고해상도 모바일 화면에서 SVG가 선명하게 나오는지 확인.
- [ ] **객체 하이라이트 및 선택**
    - [ ] SVG 요소(경로/사각형 등)에 `onClick` 핸들러 구현.
    - [ ] 히트 테스트(Hit-testing): 클릭한 요소의 ID 추출.
    - [ ] 시각적 피드백: 선택된 요소 색상 변경 (예: fill color 변경).

## 4. 기능: 점검 모드 (Inspection Modes)
- [ ] **모드 관리**
    - [ ] 앱 상태 관리를 위한 Context/Store 생성 (`VIEW_MODE` vs `CREATION_MODE`).
    - [ ] 모드 전환을 위한 FAB(Floating Action Button) 구현.
    - [ ] **UI 전환**: `CREATION_MODE` 진입 시 상단 바/테두리 변경 (기획서에 따른 녹색/파란색 보더).
- [ ] **생성 모드 인터랙션**
    - [ ] 생성 모드에서는 객체 선택(정보 보기) 비활성화.
    - [ ] "탭하여 마커 생성" 로직 활성화.
    - [ ] **좌표 캡처**: 화면 탭 좌표 $(x, y)$를 SVG 로컬 좌표 $(svg_x, svg_y)$로 변환.
    - [ ] **객체 교차 판정**: 마커 위치에 있는 BIM Element ID 식별.

## 5. 기능: 마커 생성 및 입력
- [ ] **마커 시각화**
    - [ ] 저장된 좌표에 "핀(Pin)" 아이콘을 SVG 오버레이 레이어에 렌더링.
    - [ ] 핀 생성 애니메이션 (선택 사항).
- [ ] **즉시 캡처 플로우 (Instant Capture)**
    - [ ] 마커 배치 직후 "카메라/입력 바텀 시트" 즉시 활성화.
    - [ ] **목업 카메라**: PWA PoC이므로 `capture="environment"` 속성을 가진 파일 인풋 또는 카메라 UI 플레이스홀더 사용.
- [ ] **하자 정보 입력 폼**
    - [ ] 입력 필드 구현:
        - `하자 유형` (균열, 박리 등)
        - `수치` (폭, 길이 - AI용 러프 텍스트 입력 허용).
        - `사진` (캡처된 이미지 미리보기).
        - `설명`.
    - [ ] **자동 완성**: 교차 판정으로 찾은 ID를 기반으로 "대상 부재" 필드 자동 채움.

## 6. 로컬 데이터 저장 (오프라인 우선)
- [ ] **저장소 레이어**
    - [ ] `idb` (IndexedDB 래퍼) 또는 `localStorage` 설정.
    - [ ] 스키마 정의: `InspectionStore` { `markers`: [], `images`: [] }.
- [ ] **저장 및 로드**
    - [ ] `saveMarker(marker)` 함수 구현.
    - [ ] 앱 시작 시 `loadMarkers()` 구현.
    - [ ] 마커 위치는 SVG 크기 대비 상대 좌표 혹은 로컬 좌표로 유지.

## 7. 분석 검증 (PoC 범위)
- [ ] **검토 목록**
    - [ ] 생성된 마커를 확인할 수 있는 간단한 "목록 뷰" 구현.
    - [ ] (선택 사항) 서버 동기화 시뮬레이션을 위한 "JSON 내보내기" 버튼.
