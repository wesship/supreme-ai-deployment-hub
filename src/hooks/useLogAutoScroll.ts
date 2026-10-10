import { useEffect, useRef, RefObject } from 'react';

/**
 * Hook to enable automatic scrolling of logs
 * 
 * @param scrollAreaRef Reference to the scroll area element
 * @param logs Array of logs to watch for changes
 * @param autoScroll Boolean to enable/disable auto-scrolling
 */
export const useLogAutoScroll = (
  scrollAreaRef: RefObject<HTMLDivElement>,
  logs: string[],
  autoScroll: boolean
) => {
  // Keep track of previous logs count to determine if new logs were added
  const prevLogsCountRef = useRef<number>(0);

  // Effect to handle auto-scrolling when logs change
  useEffect(() => {
    const scrollToBottom = () => {
      if (scrollAreaRef.current) {
        const scrollContainer = scrollAreaRef.current;
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    };

    // Check if new logs were added
    const newLogsAdded = logs.length > prevLogsCountRef.current;
    prevLogsCountRef.current = logs.length;

    // Scroll to bottom if auto-scroll is enabled and new logs were added
    if (autoScroll && newLogsAdded) {
      requestAnimationFrame(scrollToBottom);
    }
  }, [logs, autoScroll, scrollAreaRef]);
};

export default useLogAutoScroll;
