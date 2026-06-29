import React from 'react';
import Modal from './Modal';

interface ConfirmationDialogProps {
isOpen: boolean;
onClose: () => void;
onConfirm: () => void;
title: string;
description: string;
confirmLabel?: string;
cancelLabel?: string;
isDangerous?: boolean;
}

export default function ConfirmationDialog({
isOpen,
onClose,
onConfirm,
title,
description,
confirmLabel = 'Confirm',
cancelLabel = 'Cancel',
isDangerous = false,
}: ConfirmationDialogProps) {
const handleConfirm = () => {
onConfirm();
onClose();
};

const handleKeyDown = (e: React.KeyboardEvent) => {
if (e.key === 'Escape') onClose();
if (e.key === 'Enter') handleConfirm();
};

return (
<Modal isOpen={isOpen} onClose={onClose}>
<div
role="alertdialog"
aria-modal="true"
aria-labelledby="dialog-title"
aria-describedby="dialog-description"
onKeyDown={handleKeyDown}
className="p-6 space-y-4"
>
<h2 id="dialog-title" className="text-lg font-semibold">
{title}
</h2>
<p id="dialog-description" className="text-sm text-gray-600">
{description}
</p>
<div className="flex justify-end gap-3 pt-2">
<button
onClick={onClose}
className="px-4 py-2 text-sm rounded border border-gray-300 hover:bg-gray-100"
>
{cancelLabel}
</button>
<button
onClick={handleConfirm}
autoFocus
className={`px-4 py-2 text-sm rounded text-white ${
isDangerous
? 'bg-red-600 hover:bg-red-700'
: 'bg-blue-600 hover:bg-blue-700'
}`}
>
{confirmLabel}
</button>
</div>
</div>
</Modal>
);
}
