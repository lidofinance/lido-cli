import { program } from './command';
import './programs';
import omelette, { TreeValue } from 'omelette';


let cmdTree: TreeValue = {};
const cmdHelper = program.createHelp();
const cmds = cmdHelper.visibleCommands(program);

cmds.forEach( cmd => {
  const subTree = cmd.commands.map( subCmd => subCmd.name())
  cmdTree[cmd.name()] = subTree;
})

// what the alias for the app should be, note: should match whatever alias you set up in your .<term>rc file
const aliasName = 'lidocli';
const ommy = omelette(aliasName).tree(cmdTree);
ommy.init();

// only use if you want it to try to setup the completions automatically
if (~process.argv.indexOf('--setup')) {
  try {
    // Pick shell init file automatically
    ommy.setupShellInitFile();
  
    // Or use a manually defined init file
    // omyy.setupShellInitFile('~/.my_bash_profile')
  
  } catch (err) {
    console.log("error setting up omelette");
  }
}

program.parse(process.argv);
