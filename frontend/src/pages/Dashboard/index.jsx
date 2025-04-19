import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { getLatestMarketData } from '../../services/chartService';
import { formatNumber } from '../../utils/formatters';
import './Dashboard.css';

const Dashboard = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [marketData, setMarketData] = useState(null);
  const [error, setError] = useState(null);
  const [buyScore, setBuyScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [notificationEmail, setNotificationEmail] = useState(localStorage.getItem('notificationEmail') || '');
  const [notificationStatus, setNotificationStatus] = useState('');
  const [isSendingNotification, setIsSendingNotification] = useState(false);

  // Logout handler
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // メール通知設定を保存
  const saveNotificationEmail = () => {
    if (!notificationEmail || !notificationEmail.includes('@')) {
      setNotificationStatus('有効なメールアドレスを入力してください');
      return;
    }
    
    localStorage.setItem('notificationEmail', notificationEmail);
    setNotificationStatus('通知設定を保存しました');
    
    // 3秒後にステータスメッセージをクリア
    setTimeout(() => setNotificationStatus(''), 3000);
  };

  // シグナル通知を送信
  const sendSignalNotification = async () => {
    const email = localStorage.getItem('notificationEmail');
    if (!email) return;
    
    if (buyScore >= 70) {
      setIsSendingNotification(true);
      try {
        await api.post(api.endpoints.notifySignal, {
          signal: { 
            type: 'BUY_SIGNAL', 
            message: '買いシグナルが強くなっています。取引検討をおすすめします。' 
          },
          strength: buyScore,
          email: email
        });
        console.log('通知送信完了');
      } catch (error) {
        console.error('通知送信エラー:', error);
      } finally {
        setIsSendingNotification(false);
      }
    }
  };

  // Check API status and get data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        await api.get(api.endpoints.status);
        setConnectionStatus('connected');

        // Get market data
        try {
          const data = await getLatestMarketData();
          setMarketData(data);

          // Get buy score from API or calculate it
          const chartData = await api.get(api.endpoints.chart);
          if (chartData && chartData.buyScore !== undefined) {
            setBuyScore(chartData.buyScore);
          }
        } catch (dataErr) {
          console.error('Data fetch error:', dataErr);
          setMarketData({
            symbol: 'OKM/USDT',
            lastPrice: 0.02134,
            priceChange: -0.00023,
            priceChangePercent: -1.07,
            volume: 12456789
          });
          setBuyScore(50); // Default score
        }
      } catch (err) {
        setConnectionStatus('disconnected');
        setError('Cannot connect to API server');
        console.error('API error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();

    // Refresh data periodically
    const intervalId = setInterval(fetchData, 60000); // Every minute

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="dashboard-logo">
          <h1>BTP-kun</h1>
          <div className="subtitle">Wolf Hunter</div>
        </div>

        <nav className="dashboard-nav">
          <Link to="/dashboard" className="nav-item active">ダッシュボード</Link>
          <Link to="/settings" className="nav-item">API設定</Link>
          <button onClick={handleLogout} className="logout-button">ログアウト</button>
        </nav>
      </header>

      <main className="dashboard-content">
        {error && <div className="error-message">{error}</div>}
        {isLoading ? (
          <div className="loading-message">データを読み込み中...</div>
        ) : (
          <div className="dashboard-grid">
            {/* Market Data Panel */}
            <div className="dashboard-card market-data-grid">
              <div className="card-header">
                <h2 className="card-title">市場データ</h2>
                <div className="card-actions">
                  <span className={"status-indicator status-" + connectionStatus}></span>
                  <span>{connectionStatus === 'connected' ? '接続中' : '未接続'}</span>
                </div>
              </div>

              {marketData && (
                <div className="market-data">
                  <div className="data-row">
                    <span className="data-label">通貨ペア:</span>
                    <span className="data-value">{marketData.symbol}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">現在価格:</span>
                    <span className="data-value">{formatNumber(marketData.lastPrice, 6)}</span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">変動:</span>
                    <span className="data-value" style={{
                      color: marketData.priceChange >= 0 ? 'var(--success-color)' : 'var(--error-color)'
                    }}>
                      {formatNumber(marketData.priceChange, 6)} ({marketData.priceChangePercent}%)
                    </span>
                  </div>
                  <div className="data-row">
                    <span className="data-label">出来高:</span>
                    <span className="data-value">{formatNumber(marketData.volume)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Buy Score Meter - The Main Feature */}
            <div className="dashboard-card buy-meter-container">
              <div className="card-header">
                <h2 className="card-title">買い度メーター</h2>
              </div>
              <div className="buy-meter">
                <div
                  className="buy-meter-progress"
                  style={{
                    width: buyScore + "%",
                    backgroundColor:
                      buyScore < 30 ? 'var(--error-color)' :
                      buyScore < 50 ? 'var(--warning-color)' :
                      buyScore < 70 ? 'var(--info-color)' : 'var(--success-color)'
                  }}
                ></div>
                <div className="buy-meter-value">{buyScore}%</div>
              </div>
              <div className="buy-meter-legend">
                <div>0%</div>
                <div>低</div>
                <div>中</div>
                <div>高</div>
                <div>100%</div>
              </div>

              {/* Simple action recommendation */}
              {buyScore >= 70 && (
                <div className="buy-recommendation">
                  <div className="recommendation-title">AI推奨</div>
                  <div className="recommendation-text">
                    買いシグナルが強いです！ポジションを開くことを検討してください。
                  </div>
                  <div className="recommendation-detail">
                    推奨エントリー価格: {marketData && formatNumber(marketData.lastPrice * 0.99, 6)} (現在価格の-1%)
                  </div>
                </div>
              )}
            </div>

            {/* 通知設定パネル */}
            <div className="dashboard-card">
              <div className="card-header">
                <h2 className="card-title">通知設定</h2>
              </div>
              <div style={{ padding: '16px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label>メール通知</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      type="email" 
                      placeholder="メールアドレスを入力" 
                      value={notificationEmail}
                      onChange={(e) => setNotificationEmail(e.target.value)}
                      style={{ flex: 1, padding: '8px 12px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px' }}
                    />
                    <button 
                      onClick={saveNotificationEmail} 
                      className="button-primary"
                    >
                      保存
                    </button>
                  </div>
                  {notificationStatus && (
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#1a73e8' }}>
                      {notificationStatus}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <button 
                    onClick={sendSignalNotification}
                    disabled={!notificationEmail || buyScore < 70 || isSendingNotification}
                    className="button-secondary"
                  >
                    {isSendingNotification ? '送信中...' : 'テスト通知を送信'}
                  </button>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    ※買いシグナル強度が70%以上の時に通知されます
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
