import rc from 'rc';
import { execSync } from 'child_process';

function getDefaultGitPath() {
  try {
    if (process.platform === 'win32') {
      return execSync('where git', { encoding: 'utf8' }).trim().split('\n')[0];
    } else {
      return execSync('which git', { encoding: 'utf8' }).trim();
    }
  } catch (error) {
    return 'git';
  }
}

const defaults = {
  git: getDefaultGitPath(),
  provider: 'openai',
  model: 'gpt-4o-mini',
  apiKey: '',
};

export function getConfig() {
  return rc('commitai', defaults);
}