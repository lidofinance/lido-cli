# Testnet CLI for Lido protocol

## Requirements

- [Yarn](https://yarnpkg.com/) package manager

## Installation

Step 0. Pull the repository

Step 1. Install dependencies

```bash
yarn
```

Step 2. Fill in the `.env` using `sample.env` as a template

```bash
cp sample.env .env
```

Step 3. (Optional) If you want tab-completion, do the following:

* Set up an alias in your `.<term>rc` file (note this makes the alias global), eg:
```bash
# in bash
alias lidocli="./testnet.sh $@"

# in zsh (couldn't get alias method to work)
lidocli() { /.testnet.sh $@ }
```

* Reload your shell, set up the completion (attempts to do it automatically, otherwise you might need to try to do it manually)
```bash
lidocli --setup
```
If you'd rather do it manually, [check the omelette instructions](https://github.com/f/omelette#manual-installation).

* Reload your shell, eg:
```shell
# bash 
source ~/.bashrc
# and/or (depending)
source ~/.bash_profile.rc

# plain zsh
source ~/.zshrc

# omz on MacOS
omz reload
```

## Run

Run `./testnet.sh` to see the list of available commands.

If using the tab completion, try `lidocli<tab><tab>` to see a list of parent level commands, and `lidocli <cmd><tabtab>` to see children (1 level deep only currently.)
