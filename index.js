require("dotenv").config();

const { App } = require("@slack/bolt");
const { Octokit }= require("@octokit/core");

const octokit = new Octokit(); 

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

const log_count = 10;

const repo_map = new Map();

app.command("/gitlogger-add-repo", async ({command, ack, respond}) => {
  await ack();
  const [owner, repo, name] = command.text.trim().split(/\s+/);
  if (!(repo && owner && name)) {
    await respond({ text: `Please enter a value for all inputs!` });
    return;
  }
  if (repo_map.has(name)) {
    await respond({ text: `Repo ${name} already exists!` });
    return;
  }
  repo_map.set(name, `${owner}/${repo}`);
  await respond({ text: `Repo by ${owner} called ${repo} added as ${name}` });
});

app.command("/gitlogger-rm-repo", async ({command, ack, respond}) => {
  await ack();
  const name = command.text.trim();
  if (!name) {
    await respond({ text: `Usage: /gitlogger-rm-repo <name>` });
    return;
  }
  const existed = repo_map.delete(name);
  if (!existed) {
    await respond({ text: `Repo ${name} not found!` });
    return;
  }
  await respond({ text: `Repo ${name} has been removed` });
});

app.command("/gitlogger-log", async ({command, ack, respond}) => {
  await ack();
  const name = command.text.trim();
  let data = repo_map.get(name);
  if (!data) {
    await respond({text: `Repo with name ${name} hasn't been added yet!`});
    return;
  }
  const [owner, repo] = data.trim().split('/');
  try {
        const response = await octokit.request("GET /repos/{owner}/{repo}/commits", {
        owner, repo, per_page: log_count,
    });
    const text = response.data
    .map(c => `\`${c.sha.slice(0,7)}\` ${c.commit.message.split("\n")[0]} - ${c.commit.author.name}`)
    .join("\n");
  }
  catch {
    await respond({ text: `Fetching git log failed! Few things you can do include:
                            1. Try again after ~5 minutes (API might be rate limited)
                            2. Double check the owner annd repo provided.
                            3. Remove and re-add the repo.`})
    return;
  }
  text ? await respond({ text: `Logging last ${log_count} commits from ${name}: \n ${text}`}) : await respond({ text: `Logging last ${log_count} commits from ${name} failed!`});
});

app.command("/gitlogger-help", async ({command, ack, respond}) => {
    await ack();
    // TODO: Figure out a way to remove many of these escape chars.
    await respond({ text: `Gitlogger commands:
    \`/gitlogger-add-repo <owner> <repo> <alias_name>\` - add a GitHub repo
    \`/gitlogger-log <alias_name>\` - show recent commits
    \`/gitlogger-remove-repo <alias_name>\` - remove a repo`})
});

(async () => {
  await app.start();
  console.log("bot is running!");
})();
