type Props = {
  children: React.ReactNode;
};

export function ActionTooltipLabel({ children }: Props) {
  return (
    <span className="action-tooltip__label" role="tooltip">
      {children}
    </span>
  );
}