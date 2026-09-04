import React, { useState, useEffect } from 'react';
import { ShieldCheck, QrCode, AlertCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiClient } from '../../services/api';

interface MfaModalProps {
  isSetup: boolean;
  onClose: () => void;
}

export const MfaModal: React.FC<MfaModalProps> = ({ isSetup, onClose }) => {
  const { verifyMfa, tempToken } = useAuth();
  const [code, setCode] = useState('');
  const [qrUri, setQrUri] = useState<string | null>(null);
  const [secretKey, setSecretKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDevSecret, setShowDevSecret] = useState(false);

  useEffect(() => {
    const fetchSetupData = async () => {
      if (tempToken) {
        try {
          const res = await apiClient.get('/auth/mfa-setup', {
            headers: { Authorization: `Bearer ${tempToken}` }
          });
          setQrUri(res.data.qr_code_data_uri);
          setSecretKey(res.data.manual_entry_key);
        } catch (e) {
          // Handled
        }
      }
    };
    fetchSetupData();
  }, [tempToken]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await verifyMfa(code);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.message || 'MFA code verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-industrial-900 border border-industrial-800 rounded-xl max-w-sm w-full p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white tracking-wide">TOTP MFA CHALLENGE</h2>
            <p className="text-[11px] text-slate-400">Zero-Cloud Offline Authenticator</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Only show QR Code & Secret during Initial Setup OR if explicitly revealed for local dev */}
        {isSetup ? (
          <div className="mb-4 text-center">
            {qrUri && (
              <div className="mb-2">
                <p className="text-[11px] text-slate-300 mb-1">Scan QR code in your Authenticator App:</p>
                <div className="inline-block p-1.5 bg-white rounded-lg shadow-md">
                  <img src={qrUri} alt="TOTP QR Code" className="w-32 h-32 object-contain mx-auto" />
                </div>
              </div>
            )}
            {secretKey && (
              <div className="bg-industrial-950 p-2 rounded border border-industrial-800 text-[11px] text-left">
                <span className="text-slate-400 block text-[10px]">Authenticator Secret Key (Base32):</span>
                <span className="font-mono text-cyan-400 select-all font-semibold break-all">{secretKey}</span>
              </div>
            )}
          </div>
        ) : (
          showDevSecret && (
            <div className="mb-4 p-2.5 rounded bg-industrial-950 border border-industrial-800 text-center">
              {qrUri && (
                <div className="mb-2">
                  <p className="text-[10px] text-amber-400 font-bold mb-1">DEVELOPMENT INSPECTION QR:</p>
                  <div className="inline-block p-1 bg-white rounded">
                    <img src={qrUri} alt="TOTP QR Code" className="w-24 h-24 object-contain mx-auto" />
                  </div>
                </div>
              )}
              {secretKey && (
                <div className="text-[10px] font-mono text-slate-400">
                  <span>Dev Secret: </span>
                  <span className="text-cyan-400 select-all font-bold">{secretKey}</span>
                </div>
              )}
            </div>
          )
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                6-Digit Authenticator Code
              </label>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await apiClient.get('/auth/current-totp', {
                      headers: { Authorization: `Bearer ${tempToken}` }
                    });
                    if (res.data?.code) {
                      setCode(res.data.code);
                    }
                  } catch (err) {
                    // Fallback
                  }
                }}
                className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
              >
                <Sparkles className="w-3 h-3" />
                <span>Auto-fill Current Code</span>
              </button>
            </div>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              autoFocus
              className="w-full text-center tracking-[0.4em] font-mono text-xl bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-cyan-400 placeholder-slate-700 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold py-2 rounded-lg text-xs transition flex items-center justify-center gap-2"
          >
            <span>{loading ? 'Verifying...' : 'Verify TOTP & Access Workbench'}</span>
          </button>
        </form>

        {!isSetup && (
          <div className="mt-3 flex justify-between items-center text-[10px] text-slate-500">
            <button
              type="button"
              onClick={() => setShowDevSecret(!showDevSecret)}
              className="hover:text-slate-400 underline"
            >
              {showDevSecret ? 'Hide Dev Setup Key' : '⚙ Show Dev Key / QR'}
            </button>
            <span>Production Mode: Device Only</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 text-center text-xs text-slate-500 hover:text-slate-400 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
