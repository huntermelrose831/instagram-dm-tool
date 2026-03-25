; Instagram DM Tool - Custom NSIS Installer Script
; Enhanced installer features and branding

!include "MUI2.nsh"
!include "FileFunc.nsh"

; Custom installer pages and functionality
!define MUI_CUSTOMFUNCTION_GUIINIT onGUIInit

; Welcome page customization
!define MUI_WELCOMEPAGE_TITLE "Welcome to Instagram DM Tool Setup"
!define MUI_WELCOMEPAGE_TEXT "This wizard will guide you through the installation of Instagram DM Tool, a professional Instagram marketing automation platform.$\r$\n$\r$\nClick Next to continue."

; Finish page customization
!define MUI_FINISHPAGE_TITLE "Instagram DM Tool Installation Complete"
!define MUI_FINISHPAGE_TEXT "Instagram DM Tool has been successfully installed on your computer.$\r$\n$\r$\nYou can now launch the application from your desktop or start menu."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Instagram DM Tool.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Instagram DM Tool now"
!define MUI_FINISHPAGE_SHOWREADME ""
!define MUI_FINISHPAGE_SHOWREADME_TEXT "View Quick Start Guide"
!define MUI_FINISHPAGE_SHOWREADME_FUNCTION ShowReadme

; Custom functions
Function onGUIInit
    ; Set installer window properties
    System::Call 'user32::SetWindowText(i $HWNDPARENT, t "Instagram DM Tool Setup - Professional Instagram Marketing")'
FunctionEnd

Function ShowReadme
    ; Open quick start guide or documentation
    ExecShell "open" "https://github.com/huntermelrose831/instagram-dm-tool/blob/main/README.md"
FunctionEnd

; Check for running instances
Function .onInit
    ; Check if the application is already running
    System::Call 'kernel32::CreateMutex(p 0, b 0, t "InstagramDMToolMutex") p .r1 ?e'
    Pop $R0
    StrCmp $R0 0 +3
        MessageBox MB_OK|MB_ICONEXCLAMATION "Instagram DM Tool is currently running. Please close it before installing."
        Abort
        
    ; Check Windows version
    ${If} ${AtMostWin7}
        MessageBox MB_OK|MB_ICONSTOP "Instagram DM Tool requires Windows 8 or later."
        Abort
    ${EndIf}
FunctionEnd

; Custom installation steps
Function .onInstSuccess
    ; Create application data directory
    CreateDirectory "$APPDATA\Instagram DM Tool"
    
    ; Set file associations (optional)
    ; WriteRegStr HKCR ".dmtool" "" "InstagramDMTool"
    ; WriteRegStr HKCR "InstagramDMTool" "" "Instagram DM Tool Project File"
    
    ; Write uninstaller registry entries
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "DisplayName" "Instagram DM Tool"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "DisplayVersion" "${VERSION}"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "Publisher" "Hunter Melrose"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "DisplayIcon" "$INSTDIR\Instagram DM Tool.exe"
    WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "UninstallString" "$INSTDIR\Uninstall Instagram DM Tool.exe"
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "NoModify" 1
    WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool" "NoRepair" 1
FunctionEnd

; Uninstaller
Section "Uninstall"
    ; Remove files
    Delete "$INSTDIR\Instagram DM Tool.exe"
    Delete "$INSTDIR\Uninstall Instagram DM Tool.exe"
    RMDir /r "$INSTDIR"
    
    ; Remove shortcuts
    Delete "$DESKTOP\Instagram DM Tool.lnk"
    Delete "$SMPROGRAMS\Instagram DM Tool\Instagram DM Tool.lnk"
    Delete "$SMPROGRAMS\Instagram DM Tool\Uninstall Instagram DM Tool.lnk"
    RMDir "$SMPROGRAMS\Instagram DM Tool"
    
    ; Remove registry entries
    DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Instagram DM Tool"
    
    ; Ask about user data
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove all user data and settings?" IDNO +2
    RMDir /r "$APPDATA\Instagram DM Tool"
SectionEnd
