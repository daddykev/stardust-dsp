import { ref, onUnmounted } from 'vue';
import analyticsService from '../services/analytics';

export function usePlayTracking() {
  const currentPlayId = ref(null);
  const playStartTime = ref(null);
  const trackingInterval = ref(null);

  // Start tracking a play
  const startTracking = async (track, release, userId) => {
    try {
      // End any existing tracking
      if (currentPlayId.value) {
        await endTracking();
      }

      // Start new tracking session
      playStartTime.value = Date.now();
      currentPlayId.value = await analyticsService.trackPlay(
        track.id,
        release.id,
        userId,
        {
          source: 'web_player',
          quality: 'high',
          userAgent: navigator.userAgent,
          referrer: document.referrer
        }
      );

      // Update progress every 10 seconds
      trackingInterval.value = setInterval(() => {
        updateProgress();
      }, 10000);

    } catch (error) {
      console.error('Error starting play tracking:', error);
    }
  };

  // Update play progress
  const updateProgress = async (percentage = null) => {
    if (!currentPlayId.value || !playStartTime.value) return;

    const duration = Math.floor((Date.now() - playStartTime.value) / 1000);
    const completed = percentage >= 95;

    try {
      await analyticsService.updatePlayProgress(
        currentPlayId.value,
        duration,
        percentage || 0,
        completed
      );
    } catch (error) {
      console.error('Error updating play progress:', error);
    }
  };

  // End tracking
  const endTracking = async () => {
    if (trackingInterval.value) {
      clearInterval(trackingInterval.value);
      trackingInterval.value = null;
    }

    if (currentPlayId.value) {
      await updateProgress(100);
      currentPlayId.value = null;
      playStartTime.value = null;
    }
  };

  // Clean up on unmount
  onUnmounted(() => {
    endTracking();
  });

  return {
    startTracking,
    updateProgress,
    endTracking
  };
}