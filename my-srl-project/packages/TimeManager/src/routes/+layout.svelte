<!-- +layout.svelte -->
<script lang="ts">
  import Header from './Header.svelte';
  import './layout.css';

  let { children } = $props();
</script>

<div class="app">
  <Header />

  <main>
    {@render children()}
  </main>

  <footer>
    <p>
      Built with <span class="heart">❤️</span> using SvelteKit
    </p>
  </footer>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 2rem 1rem;
    width: 100%;
    max-width: 1400px;
    margin: 0 auto;
    box-sizing: border-box;
  }

  footer {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    padding: 1.5rem;
    background: rgba(0, 0, 0, 0.1);
    backdrop-filter: blur(10px);
    color: white;
    font-size: 0.875rem;
  }

  footer p {
    margin: 0;
  }

  .heart {
    color: #ff6b6b;
    display: inline-block;
    animation: heartbeat 1.5s ease-in-out infinite;
  }

  @keyframes heartbeat {
    0%, 100% { 
      transform: scale(1); 
    }
    25% { 
      transform: scale(1.1); 
    }
    50% { 
      transform: scale(1); 
    }
  }

  @media (max-width: 768px) {
    main {
      padding: 1rem 0.5rem;
    }

    footer {
      padding: 1rem;
      font-size: 0.813rem;
    }
  }

  @media (min-width: 480px) {
    footer {
      padding: 1.5rem 0;
    }
  }
</style>