use std::fmt;
use std::path::PathBuf;
use std::process::{Command, Stdio};

use serde::{Deserialize, Serialize};

use crate::game::state::types::{GameState, Player};

const EXPECTED_BOARD_LEN: usize = 19;

#[derive(Clone, Debug)]
pub struct PythonBridgeConfig {
    pub python_executable: PathBuf,
    pub workspace_root: PathBuf,
}

impl Default for PythonBridgeConfig {
    fn default() -> Self {
        Self {
            python_executable: PathBuf::from("python3"),
            workspace_root: PathBuf::from("."),
        }
    }
}

#[derive(Serialize)]
pub struct BridgePayload {
    pub board: Vec<Vec<u8>>,
    pub ai: Player,
    pub black_captures: usize,
    pub white_captures: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_depth: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_limit_ms: Option<u32>,
}

#[derive(Deserialize)]
struct BridgeResponse {
    ok: bool,
    #[serde(default, rename = "move")]
    move_: Option<(usize, usize)>,
    #[serde(default)]
    error: Option<String>,
}

#[derive(Debug)]
pub enum BridgeError {
    Io(std::io::Error),
    Json(serde_json::Error),
    Protocol(String),
    UnsupportedBoardSize(usize),
}

impl fmt::Display for BridgeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            BridgeError::Io(e) => write!(f, "{e}"),
            BridgeError::Json(e) => write!(f, "{e}"),
            BridgeError::Protocol(s) => f.write_str(s),
            BridgeError::UnsupportedBoardSize(n) => {
                write!(f, "board size {n} is not supported by the Python AI")
            }
        }
    }
}

impl std::error::Error for BridgeError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            BridgeError::Io(e) => Some(e),
            BridgeError::Json(e) => Some(e),
            _ => None,
        }
    }
}

impl From<std::io::Error> for BridgeError {
    fn from(value: std::io::Error) -> Self {
        BridgeError::Io(value)
    }
}

impl From<serde_json::Error> for BridgeError {
    fn from(value: serde_json::Error) -> Self {
        BridgeError::Json(value)
    }
}

impl BridgePayload {
    pub fn from_game_state(state: &GameState, ai: Player) -> Result<Self, BridgeError> {
        let n = state.board.len();
        if n != EXPECTED_BOARD_LEN || state.board.iter().any(|r| r.len() != n) {
            return Err(BridgeError::UnsupportedBoardSize(n));
        }
        let mut board = vec![vec![0u8; n]; n];
        for y in 0..n {
            for x in 0..n {
                board[y][x] = match state.board[y][x] {
                    None => 0,
                    Some(Player::Black) => 1,
                    Some(Player::White) => 2,
                };
            }
        }
        let black_captures = state
            .captures
            .get(&Player::Black)
            .map(|(c, _)| *c)
            .unwrap_or(0);
        let white_captures = state
            .captures
            .get(&Player::White)
            .map(|(c, _)| *c)
            .unwrap_or(0);
        Ok(Self {
            board,
            ai,
            black_captures,
            white_captures,
            max_depth: None,
            time_limit_ms: None,
        })
    }
}

pub fn invoke_python_ai(
    config: &PythonBridgeConfig,
    payload: &BridgePayload,
) -> Result<Option<(usize, usize)>, BridgeError> {
    if payload.board.len() != EXPECTED_BOARD_LEN {
        return Err(BridgeError::UnsupportedBoardSize(payload.board.len()));
    }
    let stdin_json = serde_json::to_string(payload)?;
    let mut child = Command::new(&config.python_executable)
        .current_dir(&config.workspace_root)
        .arg("-m")
        .arg("ai.bridge")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        stdin.write_all(stdin_json.as_bytes())?;
    }
    let output = child.wait_with_output()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let parsed: BridgeResponse = serde_json::from_str(stdout.trim()).map_err(|e| {
        BridgeError::Protocol(format!(
            "invalid bridge stdout: {e}; stderr: {stderr}"
        ))
    })?;
    if !parsed.ok {
        let msg = parsed
            .error
            .unwrap_or_else(|| "unknown bridge error".to_string());
        return Err(BridgeError::Protocol(msg));
    }
    Ok(parsed.move_)
}

pub fn invoke_python_ai_from_game_state(
    config: &PythonBridgeConfig,
    state: &GameState,
    ai: Player,
) -> Result<Option<(usize, usize)>, BridgeError> {
    let payload = BridgePayload::from_game_state(state, ai)?;
    invoke_python_ai(config, &payload)
}
