import React from "react";
import { render, hydrate } from "react-dom";
import createBrowserHistory from "history/createBrowserHistory";

export function defaultRenderStart(Component, ssr, element) {
  if (ssr) {
    hydrate(<Component />, element);
  } else {
    render(<Component />, element);
  }
}

export function loadSubApp(info, renderStart) {
  let webSubApps = window.webSubApps;
  if (!webSubApps) webSubApps = window.webSubApps = {};

  const name = info.name;
  let subApp = webSubApps[name] || { info };

  // mark the subapp's webpack bundle as loaded
  const lname = name.toLowerCase();
  if (!webSubApps._bundles[lname]) {
    webSubApps._bundles[lname] = true;
  }

  if (subApp._started) {
    console.error("SubApp", name, "already loaded");
    return undefined;
  }

  subApp._started = [];
  webSubApps[name] = subApp;

  subApp._renderStart =
    renderStart ||
    function(options, element) {
      return defaultRenderStart(
        this.info.StartComponent || this.info.Component,
        options.serverSideRendering,
        element
      );
    };

  subApp.start = options => {
    let instance;
    let element;
    const id = options.id || options.elementId;

    if (id) {
      element = document.getElementById(id);
      instance = subApp._started.find(x => x.id === id);

      if (!instance) {
        instance = Object.assign({}, options, { id, element });
        subApp._started.push(instance);
      } else {
        instance.element = element;
      }
    } else {
      console.error(`Starting subapp ${name} without options.id`);
      return undefined;
    }

    // if user provided a start function, then user is expected to
    // have reference to info
    if (subApp.info.start) return subApp.info.start(instance, element);

    console.log("rendering subapp", name, "into", element);
    return subApp._renderStart(instance, element);
  };

  const onLoadStart = webSubApps._onLoadStart[name];
  webSubApps._onLoadStart[name] = [];

  if (onLoadStart && onLoadStart.length > 0) {
    onLoadStart.forEach(options => setTimeout(() => subApp.start(options), 0));
  }

  return undefined;
}

export function dynamicLoadSubApp(options) {
  // TODO: timeout and callback
  const wsa = window.webSubApps;
  const lname = options.name.toLowerCase();

  if (wsa._bundles[lname] === undefined) {
    window.loadSubAppBundles(lname);
  }

  const load = delay => {
    setTimeout(() => {
      const subApp = wsa[options.name];
      const element = document.getElementById(options.id);
      if (element && subApp && subApp.start) {
        subApp.start({ id: options.id });
      } else {
        load(50);
      }
    }, delay);
  };

  load(0);
}

export function getBrowserHistory() {
  const wsa = window.webSubApps;
  if (!wsa.history) wsa.history = createBrowserHistory();
  return wsa.history;
}
