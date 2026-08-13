use developer_control_center_lib::pipeline::discovery::ProjectScanner;
use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();
    let path = if args.len() > 1 {
        &args[1]
    } else {
        "E:/Github project/ai-travel-marketplace"
    };
    
    println!("Scanning path: {}", path);
    let intel = ProjectScanner::scan(path);
    
    println!("{:#?}", intel);
}
