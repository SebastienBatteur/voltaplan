import { useEffect, useState } from 'react';

/**
 * Champ numérique qu'on peut vider et retaper librement (ex. remplacer « 1 » par « 3 »).
 * La valeur n'est appliquée que lorsqu'elle est valide et dans les bornes ; la virgule est acceptée (2,5).
 * En quittant le champ (ou Échap), un texte invalide ou vide reprend la valeur actuelle.
 */
export function NumberField({
  value,
  onCommit,
  min,
  max,
  step,
  className,
  title,
}: {
  value: number;
  onCommit: (n: number) => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  className?: string;
  title?: string;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Valeur changée ailleurs (annuler, autre élément sélectionné…) : on suit, sauf pendant la saisie
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const parse = (s: string): number | null => {
    const n = Number(s.trim().replace(',', '.'));
    if (s.trim() === '' || !Number.isFinite(n)) return null;
    if (min !== undefined && n < min) return null;
    if (max !== undefined && n > max) return null;
    return n;
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      title={title}
      value={text}
      onFocus={(e) => {
        setEditing(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = parse(e.target.value);
        if (n !== null && n !== value) onCommit(n);
      }}
      onBlur={() => {
        setEditing(false);
        setText(String(value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          setText(String(value));
          e.currentTarget.blur();
        } else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && step !== 'any') {
          // Flèches : comme un champ numérique classique
          e.preventDefault();
          const d = (step ?? 1) * (e.key === 'ArrowUp' ? 1 : -1);
          const n = Math.round((value + d) * 1000) / 1000;
          if (parse(String(n)) !== null) {
            onCommit(n);
            setText(String(n));
          }
        }
      }}
      style={{ width: '6em' }}
    />
  );
}
