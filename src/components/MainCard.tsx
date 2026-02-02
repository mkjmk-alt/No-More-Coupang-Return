import './MainCard.css';

interface MainCardProps {
    onCameraScan: () => void;
    onPhotoCapture: () => void;
    onImageUpload: () => void;
}

export function MainCard({ onCameraScan, onPhotoCapture, onImageUpload }: MainCardProps) {
    return (
        <div className="main-card-neo">
            {/* Yellow Hero Card */}
            <div className="hero-box">
                <div className="barcode-graphic">
                    <div className="bar bar-1"></div>
                    <div className="bar bar-2"></div>
                    <div className="bar bar-3"></div>
                    <div className="bar bar-2"></div>
                    <div className="bar bar-4"></div>
                    <div className="bar bar-1"></div>
                    <div className="bar bar-3"></div>
                    <div className="bar bar-4"></div>
                </div>
                <h2>무엇을<br />스캔할까요?</h2>
            </div>

            {/* Staggered Buttons */}
            <div className="action-stack">
                <button className="neo-stack-btn blue" onClick={onCameraScan}>
                    <div className="icon-wrap">
                        <span className="material-symbols-outlined">photo_camera</span>
                    </div>
                    <div className="btn-label-stack">
                        <span>Scan</span>
                        <span>Camera</span>
                    </div>
                </button>

                <button className="neo-stack-btn pink right" onClick={onPhotoCapture}>
                    <div className="icon-wrap">
                        <span className="material-symbols-outlined">qr_code_2</span>
                    </div>
                    <div className="btn-label-stack">
                        <span>QR Code</span>
                    </div>
                </button>

                <button className="neo-stack-btn green" onClick={onImageUpload}>
                    <div className="icon-wrap">
                        <span className="material-symbols-outlined">image</span>
                    </div>
                    <div className="btn-label-stack">
                        <span>Gallery</span>
                    </div>
                </button>
            </div>
        </div>
    );
}
