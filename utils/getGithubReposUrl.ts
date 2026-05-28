async function getGithubReposUrl({ username }: { username: string }) {
  const res = await fetch(
    `https://api.github.com/users/${username}/repos?per_page=100&page=1`,
  );
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }
  const repos = await res.json();
  return repos.map((r: any) => r.html_url);
}

export { getGithubReposUrl };
