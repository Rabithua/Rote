import ReactDOM from 'react-dom/client';
import '@/styles/index.css';
import './utils/i18n';
import AppWrapper from './App';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(<AppWrapper />);
