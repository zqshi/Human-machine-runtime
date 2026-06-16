import { useState, useCallback } from 'react';

const LS_KEY = 'dcf_oc_guide_done';

export function useGuideTour() {
  const [showTour, setShowTour] = useState(() => !localStorage.getItem(LS_KEY));
  const completeTour = useCallback(() => setShowTour(false), []);
  return { showTour, completeTour };
}
