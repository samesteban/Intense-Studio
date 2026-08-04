/**
 * Digital Receipt Modal
 * Displays printable receipt with attended classes detail and image sharing / clipboard copying
 */
import React, { useState, useRef } from 'react';
import { Printer, Share2, Check, Dumbbell, Download, Copy, Image as ImageIcon, Sparkles } from 'lucide-react';
import { toBlob } from 'html-to-image';
import { Payment, AttendanceRecord } from '../types';

interface ReceiptModalProps {
  payment: Payment | null;
  attendances?: AttendanceRecord[];
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ payment, attendances = [], onClose }) => {
  const [textCopied, setTextCopied] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  const receiptRef = useRef<HTMLDivElement>(null);

  if (!payment) return null;

  // Filter student attendances for this receipt
  const studentAttendances = attendances
    .filter((a) => {
      if (payment.studentId && a.studentId) {
        return a.studentId === payment.studentId;
      }
      return a.studentName.toLowerCase().trim() === payment.studentName.toLowerCase().trim();
    })
    .sort((a, b) => new Date(`${b.date}T${b.time || '00:00'}`).getTime() - new Date(`${a.date}T${a.time || '00:00'}`).getTime());

  const handlePrint = () => {
    window.print();
  };

  const receiptText = `🏋️‍♂️ *COMPROBANTE DE PAGO - INTENSE STUDIO* 🏋️‍♂️
----------------------------------
N° Recibo: ${payment.receiptNumber}
Fecha de Pago: ${payment.paymentDate}
Alumno: ${payment.studentName}
----------------------------------
Monto: $${payment.amount.toLocaleString('es-CL')} CLP
Forma de Pago: ${payment.paymentMethod.toUpperCase()}
${payment.notes ? `Notas: ${payment.notes}\n` : ''}----------------------------------
*Clases Asistidas (${studentAttendances.length}):*
${
  studentAttendances.length > 0
    ? studentAttendances.slice(0, 8).map((a) => `• ${a.date} (${a.time || ''}): ${a.className}`).join('\n')
    : 'Sin asistencias registradas a la fecha'
}
----------------------------------
¡Gracias por tu pago! Sigamos entrenando con todo en Intense Studio. 💪`;

  const handleCopyText = () => {
    navigator.clipboard.writeText(receiptText);
    setTextCopied(true);
    setTimeout(() => setTextCopied(false), 3000);
  };

  // Helper to generate Image Blob from HTML element
  const generateImageBlob = async (): Promise<Blob | null> => {
    if (!receiptRef.current) return null;
    try {
      const blob = await toBlob(receiptRef.current, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#ffffff'
      });
      return blob;
    } catch (error) {
      console.error('Error generating image blob:', error);
      return null;
    }
  };

  // Main Share/Copy Image Handler (Mobile Native Share vs PC Clipboard Copy)
  const handleShareOrCopyImage = async () => {
    if (!receiptRef.current) return;
    setIsCapturing(true);

    try {
      const blob = await generateImageBlob();
      if (!blob) {
        setActionFeedback('No se pudo generar la imagen.');
        setIsCapturing(false);
        return;
      }

      const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        'ontouchstart' in window;

      const fileName = `Comprobante_${payment.receiptNumber}_${payment.studentName.replace(/\s+/g, '_')}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      // MOBILE: Native Share Drawer if available
      if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Comprobante de Pago ${payment.receiptNumber}`,
          text: `Comprobante ${payment.receiptNumber} - ${payment.studentName}`,
          files: [file]
        });
        setActionFeedback('¡Comprobante compartido!');
      } else {
        // DESKTOP: Copy Image Blob to Clipboard
        if (navigator.clipboard && window.ClipboardItem) {
          try {
            const item = new ClipboardItem({ 'image/png': blob });
            await navigator.clipboard.write([item]);
            setActionFeedback('¡Imagen copiada al portapapeles! Puedes pegarla (Ctrl+V) en WhatsApp.');
          } catch (clipErr) {
            // Fallback: Download image if clipboard write fails
            downloadBlob(blob, fileName);
            setActionFeedback('¡Imagen descargada a tu equipo!');
          }
        } else {
          downloadBlob(blob, fileName);
          setActionFeedback('¡Imagen descargada a tu equipo!');
        }
      }
    } catch (err) {
      console.error('Share or Copy image error:', err);
      setActionFeedback('Detalle al procesar la imagen.');
    } finally {
      setIsCapturing(false);
      setTimeout(() => setActionFeedback(null), 4000);
    }
  };

  // Helper to trigger download
  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPNG = async () => {
    setIsCapturing(true);
    try {
      const blob = await generateImageBlob();
      if (blob) {
        const fileName = `Comprobante_${payment.receiptNumber}_${payment.studentName.replace(/\s+/g, '_')}.png`;
        downloadBlob(blob, fileName);
        setActionFeedback('¡Imagen PNG descargada!');
      }
    } catch (e) {
      setActionFeedback('Error al descargar la imagen.');
    } finally {
      setIsCapturing(false);
      setTimeout(() => setActionFeedback(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative my-auto">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-slate-400 hover:text-white font-black text-lg print:hidden p-1 rounded-xl hover:bg-slate-800 transition"
        >
          ✕
        </button>

        {/* Notification Feedback Toast */}
        {actionFeedback && (
          <div className="bg-[#7628A6] text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg animate-in fade-in slide-in-from-top-2 text-center flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{actionFeedback}</span>
          </div>
        )}

        {/* Receipt Printable Card */}
        <div
          ref={receiptRef}
          className="bg-white text-slate-900 p-6 rounded-2xl space-y-4 font-mono shadow-inner border border-slate-200"
        >
          {/* Header */}
          <div className="text-center border-b pb-3 border-slate-300">
            <div className="flex items-center justify-center gap-2 font-black text-xl uppercase text-slate-950 tracking-tight">
              <Dumbbell className="w-6 h-6 text-[#7628A6]" />
              <span>INTENSE STUDIO</span>
            </div>
            <div className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
              Comprobante de Pago Oficial
            </div>
            <div className="text-xs font-bold text-slate-800 mt-1">{payment.receiptNumber}</div>
          </div>

          {/* Payment Info */}
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Fecha de Pago:</span>
              <span className="font-bold">{payment.paymentDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Alumno:</span>
              <span className="font-bold text-right">{payment.studentName}</span>
            </div>
          </div>

          <div className="border-t border-b py-2.5 border-slate-300 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Forma de Pago:</span>
              <span className="font-bold uppercase">{payment.paymentMethod}</span>
            </div>
            {payment.notes && (
              <div className="flex justify-between">
                <span className="text-slate-500">Detalle:</span>
                <span className="font-bold text-right">{payment.notes}</span>
              </div>
            )}
          </div>

          {/* Detalle de Clases Asistidas */}
          <div className="border-b pb-3 border-slate-300 space-y-2">
            <div className="flex justify-between items-center text-[11px] font-bold text-slate-800">
              <span className="uppercase tracking-wider">Clases Asistidas ({studentAttendances.length}):</span>
              <span className="text-[#7628A6] font-black text-[10px]">INTENSE GYM</span>
            </div>

            {studentAttendances.length > 0 ? (
              <div className="space-y-1 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                {studentAttendances.map((att, idx) => (
                  <div
                    key={att.id || idx}
                    className="flex justify-between items-center text-[11px] text-slate-800 py-0.5 border-b border-slate-200/60 last:border-0"
                  >
                    <span className="font-bold truncate max-w-[170px]">{att.className}</span>
                    <span className="text-[10px] text-slate-600 font-semibold shrink-0">
                      {att.date} {att.time ? `(${att.time})` : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] text-slate-500 italic py-1.5 text-center bg-slate-50 rounded-xl border border-slate-200">
                Sin asistencias registradas a la fecha
              </div>
            )}
          </div>

          {/* Total */}
          <div className="flex justify-between items-center text-base font-black text-slate-950 pt-1">
            <span>MONTO PAGADO:</span>
            <span className="text-xl text-[#7628A6] font-extrabold">${payment.amount.toLocaleString('es-CL')} CLP</span>
          </div>

          <div className="text-[10px] text-center text-slate-500 pt-2 border-t border-slate-200 italic">
            ¡Comprobante válido de recepción de pago!
          </div>
        </div>

        {/* Modal Buttons */}
        <div className="flex flex-col gap-2.5 print:hidden">
          {/* Main Action: Share Image (Mobile) or Copy Image (Desktop) */}
          <button
            onClick={handleShareOrCopyImage}
            disabled={isCapturing}
            className="w-full py-3.5 bg-[#7628A6] hover:bg-[#621d8c] text-white font-black text-xs uppercase tracking-wide rounded-2xl transition flex items-center justify-center gap-2 shadow-xl shadow-[#7628A6]/30 border border-[#9d4edd]/30 active:scale-95 disabled:opacity-50"
          >
            {isCapturing ? (
              <span>Procesando Imagen...</span>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Compartir / Copiar Imagen Voucher</span>
              </>
            )}
          </button>

          {/* Secondary Actions Row */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleDownloadPNG}
              disabled={isCapturing}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              <Download className="w-3.5 h-3.5 text-[#c77dff]" />
              <span>Guardar PNG</span>
            </button>

            <button
              onClick={handleCopyText}
              className="py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700"
            >
              {textCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-[#c77dff]" />}
              <span>{textCopied ? 'Texto Copiado' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handlePrint}
              className="flex-1 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 border border-slate-700/60"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>

            <button
              onClick={onClose}
              className="flex-1 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 font-bold text-xs rounded-xl transition border border-slate-700/60"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

