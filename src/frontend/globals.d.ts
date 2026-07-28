declare namespace React {
  class Component<P = any, S = any> {
    constructor(props: P);
    props: Readonly<P>;
    state: Readonly<S>;
    setState(state: any, callback?: () => void): void;
    forceUpdate(callback?: () => void): void;
    componentDidMount?(): void;
    componentWillUnmount?(): void;
    render(): any;
  }
  function createElement(type: any, props?: any, ...children: any[]): any;
}

declare const React: {
  Component: typeof React.Component;
  createElement: typeof React.createElement;
};

declare const ReactDOM: {
  render(element: any, container: Element | null): void;
};

declare namespace JSX {
  interface Element {}
  interface ElementClass { render: any; }
  interface ElementAttributesProperty { props: {}; }
  interface IntrinsicElements { [elementName: string]: any; }
}
