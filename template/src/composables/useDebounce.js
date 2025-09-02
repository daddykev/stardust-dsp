// template/src/composables/useDebounce.js
import { ref, customRef } from 'vue'

/**
 * Creates a debounced ref that delays updating for a given time
 * @param {any} initialValue - Initial value for the ref
 * @param {number} delay - Delay in milliseconds
 * @returns {Ref} - Debounced ref
 */
export function useDebouncedRef(initialValue, delay = 200) {
  return customRef((track, trigger) => {
    let timeout
    let value = initialValue

    return {
      get() {
        track()
        return value
      },
      set(newValue) {
        clearTimeout(timeout)
        value = newValue
        timeout = setTimeout(() => {
          trigger()
        }, delay)
      }
    }
  })
}

/**
 * Creates a debounced function that delays invoking func until after delay milliseconds
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Debounced function
 */
export function useDebounce(func, delay = 200) {
  let timeoutId = null

  const debouncedFunction = (...args) => {
    clearTimeout(timeoutId)
    
    return new Promise((resolve) => {
      timeoutId = setTimeout(() => {
        const result = func(...args)
        resolve(result)
      }, delay)
    })
  }

  // Add cancel method to allow manual cancellation
  debouncedFunction.cancel = () => {
    clearTimeout(timeoutId)
  }

  // Add flush method to immediately invoke pending call
  debouncedFunction.flush = (...args) => {
    clearTimeout(timeoutId)
    return func(...args)
  }

  return debouncedFunction
}

/**
 * Creates a throttled function that only invokes func at most once per every delay milliseconds
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @returns {Function} - Throttled function
 */
export function useThrottle(func, delay = 200) {
  let lastCall = 0
  let timeoutId = null

  const throttledFunction = (...args) => {
    const now = Date.now()
    const timeSinceLastCall = now - lastCall

    if (timeSinceLastCall >= delay) {
      lastCall = now
      return func(...args)
    } else {
      clearTimeout(timeoutId)
      
      return new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          lastCall = Date.now()
          const result = func(...args)
          resolve(result)
        }, delay - timeSinceLastCall)
      })
    }
  }

  // Add cancel method
  throttledFunction.cancel = () => {
    clearTimeout(timeoutId)
  }

  return throttledFunction
}

/**
 * Hook for debouncing a value
 * @param {any} value - Value to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Ref} - Debounced value
 */
export function useDebouncedValue(value, delay = 200) {
  const debouncedValue = ref(value)
  let timeoutId = null

  const updateDebouncedValue = (newValue) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  }

  // Watch for changes in the original value
  watchEffect(() => {
    updateDebouncedValue(value)
  })

  return debouncedValue
}

/**
 * Hook for creating a debounced search
 * @param {Function} searchFunction - Search function to debounce
 * @param {number} delay - Delay in milliseconds
 * @returns {Object} - Object with search method and loading state
 */
export function useDebouncedSearch(searchFunction, delay = 300) {
  const loading = ref(false)
  const error = ref(null)
  const results = ref([])

  const debouncedSearch = useDebounce(async (query) => {
    if (!query || query.trim() === '') {
      results.value = []
      return
    }

    loading.value = true
    error.value = null

    try {
      results.value = await searchFunction(query)
    } catch (err) {
      error.value = err.message || 'Search failed'
      results.value = []
    } finally {
      loading.value = false
    }
  }, delay)

  const search = (query) => {
    return debouncedSearch(query)
  }

  const clear = () => {
    debouncedSearch.cancel()
    results.value = []
    error.value = null
    loading.value = false
  }

  return {
    search,
    clear,
    loading,
    error,
    results
  }
}

/**
 * Hook for debouncing form input
 * @param {any} initialValue - Initial value
 * @param {Function} onChange - Callback when value changes (after debounce)
 * @param {number} delay - Delay in milliseconds
 * @returns {Object} - Object with value ref and update method
 */
export function useDebouncedInput(initialValue = '', onChange = null, delay = 500) {
  const value = ref(initialValue)
  const isPending = ref(false)

  const debouncedUpdate = useDebounce((newValue) => {
    isPending.value = false
    if (onChange) {
      onChange(newValue)
    }
  }, delay)

  const updateValue = (newValue) => {
    value.value = newValue
    isPending.value = true
    debouncedUpdate(newValue)
  }

  const reset = () => {
    value.value = initialValue
    isPending.value = false
    debouncedUpdate.cancel()
  }

  return {
    value,
    isPending,
    updateValue,
    reset
  }
}

/**
 * Hook for creating a debounced API call
 * @param {Function} apiFunction - API function to call
 * @param {Object} options - Options object
 * @returns {Object} - Object with call method and state
 */
export function useDebouncedAPI(apiFunction, options = {}) {
  const {
    delay = 500,
    immediate = false,
    onSuccess = null,
    onError = null
  } = options

  const data = ref(null)
  const error = ref(null)
  const loading = ref(false)
  const lastCallTime = ref(null)

  const debouncedCall = useDebounce(async (...args) => {
    loading.value = true
    error.value = null
    lastCallTime.value = Date.now()

    try {
      const result = await apiFunction(...args)
      data.value = result
      
      if (onSuccess) {
        onSuccess(result)
      }
      
      return result
    } catch (err) {
      error.value = err
      
      if (onError) {
        onError(err)
      }
      
      throw err
    } finally {
      loading.value = false
    }
  }, delay)

  const call = (...args) => {
    if (immediate && !lastCallTime.value) {
      return debouncedCall.flush(...args)
    }
    return debouncedCall(...args)
  }

  const cancel = () => {
    debouncedCall.cancel()
    loading.value = false
  }

  const reset = () => {
    data.value = null
    error.value = null
    loading.value = false
    lastCallTime.value = null
  }

  return {
    call,
    cancel,
    reset,
    data,
    error,
    loading
  }
}

// Export all functions as default as well
export default {
  useDebouncedRef,
  useDebounce,
  useThrottle,
  useDebouncedValue,
  useDebouncedSearch,
  useDebouncedInput,
  useDebouncedAPI
}