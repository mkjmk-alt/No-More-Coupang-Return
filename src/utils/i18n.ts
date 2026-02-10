export type Language = 'ko' | 'en';

export const translations = {
    ko: {
        nav: {
            home: '생성',
            scan: '스캔',
            records: '내역',
            dashboard: '바코드 생성',
            scanner: '스캐너',
            compare: '분석/비교',
            settings: '비교 분석',
            history: '활동 내역',
            ai: '스마트 어시스턴트',
            categories: {
                barcode: '바코드',
                expiration: '유통기한',
                ai: '스마트 기능'
            }
        },
        generate: {
            heroTitle: '새로운 바코드 생성',
            heroSub: '값을 입력하여 전문가 수준의 바코드나 QR 코드를 즉시 생성하세요.',
            placeholder: '예: 123456789',
            btnGenerate: '바코드 생성하기',
            errorEmpty: '텍스트를 입력해주세요',
            errorInvalid: '이 형식에 지원되지 않는 문자가 포함되어 있습니다.',
            errorFailed: '생성에 실패했습니다. 입력을 확인해주세요.',
            resultTitle: '생성 결과',
            btnCopy: '복사',
            btnSave: '저장',
            copied: '클립보드에 복사되었습니다.',
            recentTitle: '최근 생성 항목',
            viewAll: '전체 보기',
            noHistory: '기록이 없습니다.'
        },
        scan: {
            title: '바코드 스캔',
            tip: '프레임 안에 바코드를 맞춰주세요',
            initializing: '초기화 중...',
            btnUpload: '이미지 업로드',
            errorPermission: '카메라 권한이 거부되었습니다.',
            errorRecognition: '바코드를 인식할 수 없습니다.'
        },
        history: {
            title: '활동 내역',
            clearAll: '전체 삭제',
            clearConfirm: '모든 기록을 삭제하시겠습니까?',
            noRecords: '활동 내역이 없습니다.',
            getStarted: '시작하기',
            barcode: '바코드',
            qr: 'QR 코드'
        },
        compare: {
            title: '바코드 비교 분석',
            sub: '이미지를 업로드하여 텍스트를 인식하고 정밀하게 비교해보세요.',
            uploadTitle: '이미지 업로드',
            dropZoneText: '원본 바코드 이미지를 업로드하려면 클릭하세요.',
            dropZoneHint: '선명한 이미지일수록 인식률이 높습니다.',
            analyzing: '분석 중...',
            generating: '생성 중...',
            resultTitle: '인식 결과',
            labelResult: '인식된 텍스트',
            labelFormat: '바코드 형식',
            confidence: '인식 신뢰도',
            recommended: '추천 형식',
            btnRegenerate: '바코드 재생성',
            compareTitle: '바코드 비교',
            modeSide: '나란히 보기',
            modeOverlay: '겹쳐서 보기',
            scale: '크기 조절',
            autoFit: '자동 맞춤',
            microAdjust: '위치 미세 조절',
            original: '원본 이미지',
            generated: '생성된 바코드',
            opacity: '겹치기 투명도',
            uploadNew: '새 이미지 업로드'
        },
        ai: {
            title: 'Gemini AI 어시스턴트',
            sub: '공식 정책 및 바코드 지식을 기반으로 똑똑하게 답변해 드립니다.',
            inputPlaceholder: '무엇이든 물어보세요...',
            btnSend: '질문하기',
            noContext: '반품 규정 등에 궁금한 점을 물어보세요.',
            connectionError: 'Gemini API 호출에 실패했습니다. API 키를 확인하세요.',
            thinking: 'AI가 분석 중입니다...',
            apiKeyRequired: '설정에서 Gemini API 키를 먼저 등록해 주세요.'
        }
    },
    en: {
        nav: {
            home: 'Generate',
            scan: 'Scan',
            records: 'Records',
            dashboard: 'Generate Barcode',
            scanner: 'Scanner',
            compare: 'Analysis',
            settings: 'Analysis',
            history: 'History',
            ai: 'Smart Assistant',
            categories: {
                barcode: 'Barcode',
                expiration: 'Expiration Date',
                ai: 'Smart Features'
            }
        },
        generate: {
            heroTitle: 'Create Barcode',
            heroSub: 'Enter a value to generate a professional barcode or QR code instantly.',
            placeholder: 'e.g. 123456789',
            btnGenerate: 'Generate Barcode',
            errorEmpty: 'Please enter some text',
            errorInvalid: 'Invalid characters for this format',
            errorFailed: 'Failed to generate. Check your input.',
            resultTitle: 'Generated Result',
            btnCopy: 'Copy',
            btnSave: 'Save',
            copied: 'Copied to clipboard',
            recentTitle: 'Recent Creations',
            viewAll: 'View All',
            noHistory: 'No history yet.'
        },
        scan: {
            title: 'Scan Barcode',
            tip: 'Align barcode within the frame',
            initializing: 'Initializing...',
            btnUpload: 'Upload Image',
            errorPermission: 'Permission Denied',
            errorRecognition: 'Could not recognize barcode.'
        },
        history: {
            title: 'Activity History',
            clearAll: 'Clear all',
            clearConfirm: 'Delete all scan records?',
            noRecords: 'No activity found',
            getStarted: 'Get Started',
            barcode: 'Barcode',
            qr: 'QR Code'
        },
        compare: {
            title: 'Barcode Analysis',
            sub: 'Upload an image to recognize text and compare with a fresh barcode.',
            uploadTitle: 'Upload Image',
            dropZoneText: 'Click to upload original barcode',
            dropZoneHint: 'Clear images work best for recognition',
            analyzing: 'Analyzing...',
            generating: 'Generating...',
            resultTitle: 'Recognition Result',
            labelResult: 'Recognized Text',
            labelFormat: 'Barcode Format',
            confidence: 'Confidence',
            recommended: 'Recommended',
            btnRegenerate: 'Regenerate',
            compareTitle: 'Comparison',
            modeSide: 'Side-by-Side',
            modeOverlay: 'Overlay',
            scale: 'Scale',
            autoFit: 'Auto Fit',
            microAdjust: 'Micro-adjust',
            original: 'Original',
            generated: 'Generated',
            opacity: 'Overlay Opacity',
            uploadNew: 'Upload New Image'
        },
        ai: {
            title: 'Gemini AI Assistant',
            sub: 'Smart answers grounded in official policies and barcode data.',
            inputPlaceholder: 'Ask anything...',
            btnSend: 'Send',
            noContext: 'Ask about return policies or barcode info.',
            connectionError: 'Gemini API call failed. Check your API key.',
            thinking: 'AI is analyzing...',
            apiKeyRequired: 'Please register your Gemini API key in settings first.'
        }
    }
};
