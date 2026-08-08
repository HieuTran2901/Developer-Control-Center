use regex::Regex;

pub fn strip_ansi(text: &str) -> String {
    // This regex matches standard CSI (Control Sequence Introducer) sequences
    // like \x1b[32m, \x1b[1;31m, \x1b[2K, etc.
    if let Ok(re) = Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]") {
        re.replace_all(text, "").into_owned()
    } else {
        text.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_strip_ansi_colors() {
        let input = "\x1b[1mLocal\x1b[22m:";
        let expected = "Local:";
        assert_eq!(strip_ansi(input), expected);
    }

    #[test]
    fn test_strip_ansi_complex() {
        let input = "\x1b[36mhttp://localhost:5173/\x1b[39m";
        let expected = "http://localhost:5173/";
        assert_eq!(strip_ansi(input), expected);
    }

    #[test]
    fn test_no_ansi() {
        let input = "Local: http://localhost:5173/";
        let expected = "Local: http://localhost:5173/";
        assert_eq!(strip_ansi(input), expected);
    }

    #[test]
    fn test_multiline_ansi() {
        let input = "\x1b[32m➜\x1b[39m  \x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:5173/\x1b[39m\n\x1b[32m➜\x1b[39m  \x1b[1mNetwork\x1b[22m: use --host to expose";
        let expected = "➜  Local:   http://localhost:5173/\n➜  Network: use --host to expose";
        assert_eq!(strip_ansi(input), expected);
    }
}
