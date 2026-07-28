import { Component, createElement, render } from './preact.mjs';

window.React = { Component, createElement };
window.ReactDOM = { render };

const script = document.createElement('script');
script.src = '/app.js';
script.defer = false;
document.body.appendChild(script);
