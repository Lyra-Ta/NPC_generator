import iframeSrcdoc from './iframe-srcdoc.html?raw';

export function teleportStyle(appendTo: Element): { destroy: () => void } {
  const $container = $('<div>')
    .attr('script_id', getScriptId())
    .append($('head > style', document).clone())
    .appendTo(appendTo);
  return { destroy: () => $container.remove() };
}

export function createScriptIdIframe(): JQuery<HTMLIFrameElement> {
  return $('<iframe>').attr({
    script_id: getScriptId(),
    frameborder: 0,
    srcdoc: iframeSrcdoc,
  }) as JQuery<HTMLIFrameElement>;
}
