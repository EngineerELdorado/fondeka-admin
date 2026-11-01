'use client';

import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

const actionSelector = 'button, a[href], input[type="button"], input[type="submit"], [role="button"]';
const useBrowserLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const initialActionCount = (children) => React.Children.toArray(children).reduce((count, child) => {
  if (!React.isValidElement(child)) return count;
  if (child.props.hidden || child.props['aria-hidden'] === true || child.props['aria-hidden'] === 'true' || child.props.style?.display === 'none' || child.props.style?.visibility === 'hidden') return count;
  if (child.type === 'button' || child.type === 'a' || child.props.href || child.props.role === 'button' || child.type === 'input' && ['button', 'submit'].includes(child.props.type)) return count + 1;
  return count + initialActionCount(child.props.children);
}, 0);

export default function TableActions({ children }) {
  const container = useRef(null), trigger = useRef(null), content = useRef(null);
  const id = useId();
  const [multiple, setMultiple] = useState(() => initialActionCount(children) > 1);
  const [open, setOpen] = useState(false);

  useBrowserLayoutEffect(() => {
    const element = content.current;
    const countActions = () => {
      const actions = [...element.querySelectorAll(actionSelector)].filter((action) => {
        // Count rendered permissions/conditions, including disabled choices, but not hidden actions.
        for (let node = action; node && node !== element; node = node.parentElement) {
          const style = window.getComputedStyle(node);
          if (node.hidden || node.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') return false;
        }
        return !action.parentElement.closest(actionSelector) || !element.contains(action.parentElement.closest(actionSelector));
      });
      setMultiple(actions.length > 1);
    };
    countActions();
    const observer = new MutationObserver(countActions);
    observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'style', 'class'] });
    return () => observer.disconnect();
  }, [children]);

  useBrowserLayoutEffect(() => {
    const menu = content.current;
    if (!multiple || !open) {
      if (!multiple && open) setOpen(false);
      if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
      return undefined;
    }
    // Native popovers escape table/modal overflow without moving or cloning the actions.
    if (typeof menu.showPopover === 'function') menu.showPopover();
    const rect = trigger.current.getBoundingClientRect();
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(rect.right - bounds.width, window.innerWidth - bounds.width - 12))}px`;
    menu.style.top = `${Math.max(12, rect.bottom + bounds.height + 6 > window.innerHeight ? rect.top - bounds.height - 6 : rect.bottom + 6)}px`;
    const choices = () => [...menu.querySelectorAll(actionSelector)].filter((action) => !action.disabled && action.getAttribute('aria-disabled') !== 'true' && action.getClientRects().length);
    (choices()[0] || menu).focus();
    const closeOutside = (event) => { if (!container.current.contains(event.target)) setOpen(false); };
    const closeOnMove = () => setOpen(false);
    const closeOnScroll = (event) => { if (!menu.contains(event.target)) setOpen(false); };
    const keyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus();
      } else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && menu.contains(event.target)) {
        event.preventDefault();
        const items = choices(), at = items.indexOf(document.activeElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (at + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    document.addEventListener('keydown', keyDown);
    document.addEventListener('scroll', closeOnScroll, true);
    window.addEventListener('resize', closeOnMove);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
      document.removeEventListener('keydown', keyDown);
      document.removeEventListener('scroll', closeOnScroll, true);
      window.removeEventListener('resize', closeOnMove);
      if (typeof menu.hidePopover === 'function' && menu.matches(':popover-open')) menu.hidePopover();
    };
  }, [open, multiple]);

  return <div ref={container} className={`table-row-actions${multiple ? '' : ' table-row-actions--single'}`}>
    {multiple ? <button ref={trigger} type="button" className="btn-neutral btn-sm" aria-expanded={open} aria-controls={id} onClick={() => setOpen((value) => !value)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); }
    }}>Actions <span aria-hidden="true">▾</span></button> : null}
    <div ref={content} id={id} popover={multiple ? 'manual' : undefined} hidden={multiple && !open} className={multiple ? 'table-row-actions__menu' : 'table-row-actions__content'} role={multiple ? 'group' : undefined} aria-label={multiple ? 'Row actions' : undefined} tabIndex={multiple ? -1 : undefined} onClick={(event) => {
      const action = event.target.closest(actionSelector);
      if (action && !action.disabled && action.getAttribute('aria-disabled') !== 'true') setOpen(false);
    }}>{children}</div>
  </div>;
}
