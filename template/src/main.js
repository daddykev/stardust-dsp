import { createApp } from 'vue'
import App from './App.vue'
import router from './router'

// Import the main CSS file
import './assets/main.css'

// FontAwesome imports
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

// Import specific icons from free solid icons
import { 
  faHome,
  faMusic,
  faUpload,
  faPlus,
  faEdit,
  faTrash,
  faCheck,
  faTimes,
  faCog,
  faChartBar,
  faCube,
  faRocket,
  faBullseye,
  faPalette,
  faCheckCircle,
  faChartLine,
  faCopy,
  faTruck,
  faMoon,
  faSun,
  faBars,
  faCompactDisc,
  faArrowRight,
  faHeadphones,
  faFlask,
  faBuilding,
  faGlobe,
  faBolt,
  faShieldAlt,
  faExpandArrowsAlt,
  faCode  
} from '@fortawesome/free-solid-svg-icons'

// Import brand icons
import { 
  faGoogle,
  faSpotify,
  faApple,
  faGithub,
  faTwitter,
  faFacebook,
  faYoutube
} from '@fortawesome/free-brands-svg-icons'

// Add solid icons to the library
library.add(
  faHome,
  faMusic,
  faUpload,
  faPlus,
  faEdit,
  faTrash,
  faCheck,
  faTimes,
  faCog,
  faChartBar,
  faCube,
  faRocket,
  faBullseye,
  faPalette,
  faCheckCircle,
  faChartLine,
  faCopy,
  faTruck,
  faMoon,
  faSun,
  faBars,
  faCompactDisc,
  faArrowRight,
  faHeadphones,
  faFlask,
  faBuilding,
  faGlobe,
  faBolt,
  faShieldAlt,
  faExpandArrowsAlt,
  faCode 
)

// Add brand icons to the library
library.add(
  faGoogle,
  faSpotify,
  faApple,
  faGithub,
  faTwitter,
  faFacebook,
  faYoutube
)

const app = createApp(App)

// Register FontAwesome component globally
app.component('font-awesome-icon', FontAwesomeIcon)

app.use(router)

app.mount('#app')