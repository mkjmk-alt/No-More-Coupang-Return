import './MainCard.css';

interface MainCardProps {
    onCameraScan: () => void;
    onImageUpload: () => void;
}

export function MainCard({ onCameraScan, onImageUpload }: MainCardProps) {
    return (
        <div className="main-card gradient-card">
            <h2 className="main-card-title">무엇을 스캔할까요?</h2>
            <p className="main-card-subtitle">
                카메라 또는 이미지를 통해<br />
                숨겨진 정보를 확인하세요.
            </p>

            <div className="main-card-actions">
                <button className="btn btn-secondary" onClick={onCameraScan}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                        <circle cx="12" cy="13" r="4" />
                    </svg>
                    카메라 스캔
                </button>

                <button className="btn btn-primary" onClick={onImageUpload}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                    </svg>
                    사진 불러오기
                </button>
            </div>
        </div>
    );
}
