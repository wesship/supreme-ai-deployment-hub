import ComingSoonPage from '@/components/ComingSoonPage';

const Backtesting = () => (
  <ComingSoonPage
    title="Backtesting"
    description="Trading and model strategy simulation against historical market data with risk-adjusted metrics."
    roadmap={[
      'Strategy builder with reusable signal blocks',
      'Multi-asset historical replay engine',
      'Risk metrics: Sharpe, Sortino, max drawdown',
      'Walk-forward and Monte Carlo validation',
    ]}
  />
);

export default Backtesting;
