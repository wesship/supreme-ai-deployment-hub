type OperatorStatusCardProps = {
  label: string;
  value: string | number;
  description: string;
  accent?: 'green' | 'cyan';
};

export function OperatorStatusCard({
  label,
  value,
  description,
  accent = 'cyan',
}: OperatorStatusCardProps) {
  return (
    <div className="operator-card metric">
      <div className="operator-label">{label}</div>
      <div className={`operator-value ${accent === 'green' ? 'operator-green' : 'operator-cyan'}`}>
        {value}
      </div>
      <p>{description}</p>
    </div>
  );
}

export default OperatorStatusCard;
