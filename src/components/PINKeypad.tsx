'use client';

/**
 * PIN Keypad Component - Mobile-style PIN input
 * Features:
 * - Numeric keypad (0-9)
 * - PIN dots display
 * - Haptic feedback
 * - Error animation
 * - Auto-submit when PIN is complete
 */

import { useState, useEffect, useCallback } from 'react';
import { Delete, CheckCircle } from 'lucide-react';

type PINKeypadProps = {
  minLength?: number;
  maxLength?: number;
  onSubmit: (pin: string) => void;
  isLoading?: boolean;
  error?: string | null;
  onClear?: () => void;
};

export default function PINKeypad({
  minLength = 4,
  maxLength = 6,
  onSubmit,
  isLoading = false,
  error = null,
  onClear,
}: PINKeypadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // Vibrate helper (no dependencies)
  const vibrate = useCallback(() => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10); // Short vibration
    }
  }, []);

  // Memoized handler functions
  const handleNumberPress = useCallback((num: string) => {
    if (pin.length < maxLength) {
      setPin(pin + num);
      vibrate();
      if (onClear) onClear(); // Clear error message
    }
  }, [pin, maxLength, onClear, vibrate]);

  const handleBackspace = useCallback(() => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1));
      vibrate();
    }
  }, [pin, vibrate]);

  const handleSubmit = useCallback(() => {
    if (pin.length >= minLength && pin.length <= maxLength) {
      onSubmit(pin);
    }
  }, [pin, minLength, maxLength, onSubmit]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isLoading) return;

      if (e.key >= '0' && e.key <= '9') {
        handleNumberPress(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      } else if (e.key === 'Enter' && pin.length >= minLength) {
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pin, isLoading, minLength, handleNumberPress, handleBackspace, handleSubmit]);

  // Auto-submit when PIN reaches max length
  useEffect(() => {
    if (pin.length === maxLength && !isLoading) {
      handleSubmit();
    }
  }, [pin, maxLength, isLoading, handleSubmit]);

  // Trigger shake animation on error
  useEffect(() => {
    if (error) {
      setShake(true);
      setPin(''); // Clear PIN on error
      setTimeout(() => setShake(false), 500);
    }
  }, [error]);

  const renderPinDots = () => {
    const dots = [];
    for (let i = 0; i < maxLength; i++) {
      const isFilled = i < pin.length;
      dots.push(
        <div
          key={i}
          className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
            isFilled
              ? 'scale-110 border-blue-600 bg-blue-600'
              : 'border-slate-300 bg-white'
          }`}
        />
      );
    }
    return dots;
  };

  const KeypadButton = ({
    value,
    onClick,
    icon,
    disabled = false,
    variant = 'default',
  }: {
    value?: string;
    onClick: () => void;
    icon?: React.ReactNode;
    disabled?: boolean;
    variant?: 'default' | 'backspace' | 'submit';
  }) => {
    const baseClass =
      'flex aspect-square w-full items-center justify-center rounded-full text-2xl font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClass = {
      default: 'bg-white border border-slate-200 text-slate-900 hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100 shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_6px_20px_0_rgba(0,0,0,0.15)] active:shadow-[0_2px_8px_0_rgba(0,0,0,0.15)]',
      backspace: 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 active:bg-red-200 shadow-[0_4px_14px_0_rgba(239,68,68,0.2)] hover:shadow-[0_6px_20px_0_rgba(239,68,68,0.25)] active:shadow-[0_2px_8px_0_rgba(239,68,68,0.25)]',
      submit: 'bg-gradient-to-br from-blue-600 to-indigo-600 border border-blue-700 text-white hover:from-blue-700 hover:to-indigo-700 active:from-blue-800 active:to-indigo-800 shadow-[0_6px_20px_0_rgba(59,130,246,0.35)] hover:shadow-[0_8px_28px_0_rgba(59,130,246,0.45)] active:shadow-[0_3px_12px_0_rgba(59,130,246,0.4)]',
    }[variant];

    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || isLoading}
        className={`${baseClass} ${variantClass}`}
      >
        {icon || value}
      </button>
    );
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      {/* PIN Dots Display */}
      <div
        className={`mb-8 flex items-center justify-center gap-3 transition-transform ${
          shake ? 'animate-shake' : ''
        }`}
      >
        {renderPinDots()}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-center text-sm text-red-700 animate-in fade-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-3">
        {/* Row 1: 1, 2, 3 */}
        {['1', '2', '3'].map((num) => (
          <KeypadButton
            key={num}
            value={num}
            onClick={() => handleNumberPress(num)}
          />
        ))}

        {/* Row 2: 4, 5, 6 */}
        {['4', '5', '6'].map((num) => (
          <KeypadButton
            key={num}
            value={num}
            onClick={() => handleNumberPress(num)}
          />
        ))}

        {/* Row 3: 7, 8, 9 */}
        {['7', '8', '9'].map((num) => (
          <KeypadButton
            key={num}
            value={num}
            onClick={() => handleNumberPress(num)}
          />
        ))}

        {/* Row 4: Backspace, 0, Submit */}
        <KeypadButton
          icon={<Delete className="h-6 w-6" />}
          onClick={handleBackspace}
          variant="backspace"
          disabled={pin.length === 0}
        />

        <KeypadButton value="0" onClick={() => handleNumberPress('0')} />

        <KeypadButton
          icon={
            isLoading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <CheckCircle className="h-6 w-6" />
            )
          }
          onClick={handleSubmit}
          variant="submit"
          disabled={pin.length < minLength || isLoading}
        />
      </div>
    </div>
  );
}
