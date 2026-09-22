import { decimalToEighths, eighthsToDecimal } from '../pageLength.js';
import { useLanguage } from '../i18n/LanguageContext.jsx';

// Editable "N X/8 pgs" control for a scene's script length, matching the
// eighths-of-a-page convention ADs use on a stripboard.
export default function PageLengthInput({ value, onCommit, remountKey }) {
  const { t } = useLanguage();
  const { whole, eighths } = decimalToEighths(value);

  return (
    <span className="page-length-input" key={remountKey}>
      <input
        type="number"
        min="0"
        step="1"
        title={t('pageLengthInput.wholePagesTooltip')}
        style={{ width: 44 }}
        defaultValue={whole}
        onBlur={(e) => onCommit(eighthsToDecimal(e.target.value, eighths))}
      />
      <select
        title={t('pageLengthInput.eighthsTooltip')}
        defaultValue={eighths}
        onChange={(e) => onCommit(eighthsToDecimal(whole, e.target.value))}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <option key={n} value={n}>
            {n}/8
          </option>
        ))}
      </select>
      <span className="muted" style={{ fontSize: 11 }}>
        {t('pageLengthInput.pagesSuffix')}
      </span>
    </span>
  );
}
