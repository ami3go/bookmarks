import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Button } from '@patternfly/react-core/dist/esm/components/Button/index.js';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@patternfly/react-core/dist/esm/components/Modal/index.js';

export function ServiceQrDialog({ target, onClose }) {
    const [svg, setSvg] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!target) {
            setSvg('');
            setError('');
            return;
        }

        let active = true;
        setSvg('');
        setError('');
        QRCode.toString(target.url, {
            type: 'svg',
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 280,
        }).then(value => {
            if (active)
                setSvg(value);
        }).catch(qrError => {
            if (active)
                setError(qrError.message || 'Could not generate QR code.');
        });

        return () => { active = false; };
    }, [target]);

    return (
        <Modal isOpen={target !== null} onClose={onClose} variant="small">
            <ModalHeader title={target ? `${target.name} QR code` : 'QR code'} />
            <ModalBody>
                {target && (
                    <div className="bookmark-qr-dialog">
                        <div className="bookmark-qr-label">{target.label}</div>
                        {svg && <div className="bookmark-qr-image" dangerouslySetInnerHTML={{ __html: svg }} />}
                        {error && <p>{error}</p>}
                        <code>{target.url}</code>
                    </div>
                )}
            </ModalBody>
            <ModalFooter>
                {target && (
                    <Button variant="primary" onClick={() => window.open(target.url, '_blank', 'noopener,noreferrer')}>
                        Open URL
                    </Button>
                )}
                <Button variant="secondary" onClick={onClose}>Close</Button>
            </ModalFooter>
        </Modal>
    );
}
