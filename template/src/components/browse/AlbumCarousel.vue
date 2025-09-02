<!-- template/src/components/browse/AlbumCarousel.vue -->
<script setup>
import { ref } from 'vue'

defineProps({
  albums: {
    type: Array,
    required: true
  }
})

defineEmits(['play', 'like'])

const container = ref(null)

function scrollLeft() {
  if (container.value) {
    container.value.scrollBy({ left: -300, behavior: 'smooth' })
  }
}

function scrollRight() {
  if (container.value) {
    container.value.scrollBy({ left: 300, behavior: 'smooth' })
  }
}
</script>

<template>
  <div class="album-carousel">
    <div class="carousel-container" ref="container">
      <div class="carousel-track">
        <div 
          v-for="album in albums" 
          :key="album.id"
          class="album-card"
          @click="$emit('play', album)"
        >
          <div class="album-cover">
            <img :src="album.artworkUrl || '/placeholder-album.png'" :alt="album.title" />
            <div class="album-overlay">
              <button class="play-btn">
                <font-awesome-icon icon="play" />
              </button>
            </div>
          </div>
          <div class="album-info">
            <h4>{{ album.title }}</h4>
            <p>{{ album.artist }}</p>
          </div>
          <button @click.stop="$emit('like', album)" class="like-btn">
            <font-awesome-icon :icon="album.isLiked ? 'heart' : ['far', 'heart']" />
          </button>
        </div>
      </div>
    </div>
    <button @click="scrollLeft" class="carousel-btn prev">
      <font-awesome-icon icon="chevron-left" />
    </button>
    <button @click="scrollRight" class="carousel-btn next">
      <font-awesome-icon icon="chevron-right" />
    </button>
  </div>
</template>

<style scoped>
.album-carousel {
  position: relative;
}

.carousel-container {
  overflow-x: auto;
  scrollbar-width: none;
}

.carousel-container::-webkit-scrollbar {
  display: none;
}

.carousel-track {
  display: flex;
  gap: var(--space-lg);
  padding: var(--space-sm);
}

.album-card {
  flex: 0 0 200px;
  cursor: pointer;
}

.album-cover {
  position: relative;
  margin-bottom: var(--space-sm);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.album-cover img {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
}

.album-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.album-card:hover .album-overlay {
  opacity: 1;
}

.play-btn {
  width: 48px;
  height: 48px;
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: transform var(--transition-base);
}

.play-btn:hover {
  transform: scale(1.1);
}

.album-info h4 {
  font-size: var(--text-sm);
  margin-bottom: var(--space-xs);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.album-info p {
  font-size: var(--text-xs);
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.like-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  padding: var(--space-xs);
  border-radius: var(--radius-full);
  cursor: pointer;
}

.carousel-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  width: 40px;
  height: 40px;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.carousel-btn.prev {
  left: -20px;
}

.carousel-btn.next {
  right: -20px;
}
</style>