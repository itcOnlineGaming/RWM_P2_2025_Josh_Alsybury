<script>
	// Import from the package (not relative path)
	import { Button, Header, Page } from '@my-srl-project/time-manager';
</script>

<div class="container">
	<h1>TimeManager Component Demo</h1>
	
	<section>
		<h2>Header Component</h2>
		<Header />
	</section>

	<section>
		<h2>Button Component</h2>
		<Button />
	</section>

	<section>
		<h2>Page Component</h2>
		<Page />
	</section>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	section {
		margin: 2rem 0;
		padding: 1rem;
		border: 1px solid #ccc;
		border-radius: 8px;
	}

	h1 {
		color: #333;
	}

	h2 {
		color: #666;
		font-size: 1.5rem;
		margin-bottom: 1rem;
	}
</style>