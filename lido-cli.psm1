function Invoke-LidoCli {
    param(
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )
    
    # Construct the command with all passed arguments
    $cmd = "yarn --silent ts-node ./index $($Arguments -join ' ')"
    
    # Execute in the same directory as the module
    Push-Location $PSScriptRoot
    try {
        Invoke-Expression $cmd
    }
    finally {
        Pop-Location
    }
}

# Export the function to make it available when importing the module
Export-ModuleMember -Function Invoke-LidoCli