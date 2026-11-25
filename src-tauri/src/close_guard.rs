// Avertissement à la fermeture de la fenêtre quand des modifications ne sont pas enregistrées (écart O10,
// docs/desktop-tauri.md). La page tient Rust au courant (`set_close_warning`) : texte traduit quand le projet est
// modifié, `None` sinon. La fermeture est interceptée ici, côté Rust : l'essai réel du 2026-11-25 a montré que
// l'interception côté page (onCloseRequested + window.confirm) laissait la fenêtre se fermer sans rien demander.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;

use tauri::{Manager, Runtime, Window, WindowEvent};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons, MessageDialogKind};

/// Texte de l'avertissement, dans la langue de la page.
#[derive(Clone, Debug, PartialEq)]
pub struct CloseWarning {
    pub title: String,
    pub message: String,
    pub close: String,
    pub cancel: String,
}

#[derive(Default)]
pub struct CloseGuard {
    warning: Mutex<Option<CloseWarning>>,
    /// Boîte déjà affichée : un second clic sur la croix n'en ouvre pas une autre.
    asking: AtomicBool,
}

impl CloseGuard {
    pub fn set(&self, warning: Option<CloseWarning>) {
        *self.warning.lock().unwrap_or_else(|e| e.into_inner()) = warning;
    }

    pub fn current(&self) -> Option<CloseWarning> {
        self.warning.lock().unwrap_or_else(|e| e.into_inner()).clone()
    }

    /// `true` si la boîte doit être ouverte maintenant (aucune autre n'est affichée).
    fn begin_asking(&self) -> bool {
        !self.asking.swap(true, Ordering::SeqCst)
    }

    fn end_asking(&self) {
        self.asking.store(false, Ordering::SeqCst);
    }
}

/// `message` absent : rien à enregistrer, la fenêtre se ferme sans question.
#[tauri::command]
pub fn set_close_warning(
    guard: tauri::State<'_, CloseGuard>,
    message: Option<String>,
    title: String,
    close: String,
    cancel: String,
) {
    guard.set(message.map(|message| CloseWarning { title, message, close, cancel }));
}

/// Fermeture demandée (croix, Alt+F4, barre des tâches) : si le projet est modifié, la fermeture est suspendue et
/// une boîte du système demande confirmation ; la fenêtre n'est détruite que sur « Fermer ».
pub fn on_window_event<R: Runtime>(window: &Window<R>, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };
    let guard = window.state::<CloseGuard>();
    let Some(w) = guard.current() else {
        return;
    };
    api.prevent_close();
    if !guard.begin_asking() {
        return;
    }
    let builder = window
        .dialog()
        .message(w.message)
        .title(w.title)
        .kind(MessageDialogKind::Warning)
        .buttons(MessageDialogButtons::OkCancelCustom(w.close, w.cancel));
    #[cfg(any(windows, target_os = "macos"))]
    let builder = builder.parent(window);
    let win = window.clone();
    builder.show(move |close| {
        win.state::<CloseGuard>().end_asking();
        if close {
            let _ = win.destroy();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn warning() -> CloseWarning {
        CloseWarning {
            title: "Voltaplan".into(),
            message: "Fermer quand même ?".into(),
            close: "Fermer".into(),
            cancel: "Annuler".into(),
        }
    }

    #[test]
    fn warning_follows_page_state() {
        let g = CloseGuard::default();
        assert_eq!(g.current(), None, "projet non modifié au départ : fermeture libre");
        g.set(Some(warning()));
        assert_eq!(g.current(), Some(warning()));
        g.set(None);
        assert_eq!(g.current(), None, "après enregistrement : fermeture libre");
    }

    #[test]
    fn only_one_dialog_at_a_time() {
        let g = CloseGuard::default();
        assert!(g.begin_asking());
        assert!(!g.begin_asking(), "second clic sur la croix : pas de seconde boîte");
        g.end_asking();
        assert!(g.begin_asking(), "après « Annuler », une nouvelle fermeture redemande");
    }
}
