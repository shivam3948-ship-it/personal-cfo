import { createRoot } from 'react-dom/client';
import Page from '../app/page';
import { installLocalApi } from './local-api';

installLocalApi();
createRoot(document.getElementById('root')!).render(<Page />);
