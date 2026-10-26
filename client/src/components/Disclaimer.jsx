export const DISCLAIMER_TEXT =
  'Spotters.com is an educational platform and is not intended to replace clinical judgment, professional training, or medical advice.';

export default function Disclaimer({ className = '' }) {
  return <p className={`text-xs text-gray-400 leading-relaxed ${className}`}>{DISCLAIMER_TEXT}</p>;
}
