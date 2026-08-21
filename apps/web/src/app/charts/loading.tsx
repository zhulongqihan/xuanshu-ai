export default function ChartsLoading() {
  return (
    <div className="page-frame" aria-busy="true" aria-label="正在读取命盘">
      <div className="chart-loading-header" />
      <div className="chart-loading-panel" />
      <div className="chart-loading-panel chart-loading-panel-tall" />
    </div>
  );
}
