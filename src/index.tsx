import React from 'react';
import ReactDOM from 'react-dom';
import { Web3ReactProvider } from '@web3-react/core';
import {
  Web3Provider,
  ExternalProvider,
  JsonRpcFetchFunc,
} from '@ethersproject/providers';
import { Switch, Route, HashRouter } from 'react-router-dom';
import App from './app';
import reportWebVitals from './report-web-vitals';
import Generator from './qr-generator';
import './index.css';
import 'antd/dist/antd.css';

const getLibrary = (
  provider: ExternalProvider | JsonRpcFetchFunc
): Web3Provider => {
  const library = new Web3Provider(provider);
  library.pollingInterval = 12000;
  return library;
};

ReactDOM.render(
  <React.StrictMode>
    <Web3ReactProvider getLibrary={getLibrary}>
      <HashRouter>
        <Switch>
          <Route path="/generator">
            <Generator />
          </Route>
          <Route path="/">
            <App />
          </Route>
        </Switch>
      </HashRouter>
    </Web3ReactProvider>
  </React.StrictMode>,
  document.querySelector('#root')
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
