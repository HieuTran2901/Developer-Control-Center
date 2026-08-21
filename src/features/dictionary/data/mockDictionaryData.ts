import { Category, GuideArticle } from '../domain/entities/GuideArticle';

export const DICTIONARY_CATEGORIES: Category[] = [
  {
    id: 'all',
    name: 'All Topics',
    icon: 'Grid',
    description: 'Explore all developer guides, command cheatsheets, and troubleshooting entries.',
  },
  {
    id: 'aws',
    name: 'AWS & Cloud',
    icon: 'Cloud',
    description: 'Cấu hình AWS CLI, Web Console, IAM Policies, EC2 Remote SSH, SSM Session Manager và AI Agents.',
    children: [
      { id: 'aws-fundamentals', parentId: 'aws', name: 'AWS Fundamentals', icon: 'BookOpen', description: 'Core AWS concepts & architecture.' },
      { id: 'aws-ec2', parentId: 'aws', name: 'EC2', icon: 'Server', description: 'Elastic Compute Cloud instances.' },
      { id: 'aws-iam', parentId: 'aws', name: 'IAM', icon: 'Shield', description: 'Identity & Access Management.' },
      { id: 'aws-ssm', parentId: 'aws', name: 'SSM', icon: 'Terminal', description: 'AWS Systems Manager Session Manager.' },
      { id: 'aws-sg', parentId: 'aws', name: 'Security Groups', icon: 'Lock', description: 'Security Group firewall rules.' },
    ],
  },
  {
    id: 'git',
    name: 'Git & Version Control',
    icon: 'GitBranch',
    description: 'Master Git workflows, branching strategies, rebase vs merge, history inspection, and emergency undo commands.',
    children: [
      { id: 'git-fundamentals', parentId: 'git', name: 'Git Fundamentals', icon: 'BookOpen', description: 'Core concepts, three states & installation.' },
      { id: 'git-repo-management', parentId: 'git', name: 'Repository Management', icon: 'Folder', description: 'Git init, clone, and repository setup.' },
      { id: 'git-staging-commits', parentId: 'git', name: 'Git Staging & Commits', icon: 'FileCheck', description: 'Staging area, commits, and amend.' },
      { id: 'git-branching', parentId: 'git', name: 'Branching', icon: 'GitBranch', description: 'Branch creation, switching, and deletion.' },
      { id: 'git-merging', parentId: 'git', name: 'Merging', icon: 'GitMerge', description: 'Fast-forward & 3-way merge workflows.' },
      { id: 'git-rebase', parentId: 'git', name: 'Rebase', icon: 'GitPullRequest', description: 'Linear history rebase & interactive rebase.' },
      { id: 'git-remote-github', parentId: 'git', name: 'Remote & GitHub', icon: 'CloudUpload', description: 'Remotes, origin, fetch, pull, and push.' },
      { id: 'git-history-inspection', parentId: 'git', name: 'Git History & Inspection', icon: 'History', description: 'Log, diff, show, blame, and reflog.' },
      { id: 'git-undo-recovery', parentId: 'git', name: 'Undo & Recovery', icon: 'RotateCcw', description: 'Restore, reset, revert, and disaster recovery.' },
      { id: 'git-stash', parentId: 'git', name: 'Stash', icon: 'Archive', description: 'Temporary change stashing & popping.' },
      { id: 'git-tags-releases', parentId: 'git', name: 'Tags & Releases', icon: 'Tag', description: 'Annotated tags & Semantic Versioning.' },
      { id: 'git-config', parentId: 'git', name: 'Git Configuration', icon: 'Sliders', description: 'Global config, aliases, and SSH keys.' },
      { id: 'git-troubleshooting', parentId: 'git', name: 'Git Troubleshooting', icon: 'AlertTriangle', description: 'Fixing top 12 Git errors & conflicts.' },
      { id: 'git-collaboration', parentId: 'git', name: 'Git Collaboration', icon: 'Users', description: 'PRs, Code reviews, and team workflows.' },
      { id: 'git-advanced', parentId: 'git', name: 'Git Advanced', icon: 'Zap', description: 'Cherry-pick, bisect, and submodules.' },
      { id: 'git-security', parentId: 'git', name: 'Git Security', icon: 'Shield', description: 'Preventing secret leaks & history cleanup.' },
      { id: 'git-production-workflows', parentId: 'git', name: 'Git Production Workflows', icon: 'CheckCircle', description: 'Trunk-based & GitFlow production strategies.' },
    ],
  },
  {
    id: 'docker',
    name: 'Docker & DevOps',
    icon: 'Box',
    description: 'Containerization, Docker Compose setups, networking, volumes, and production deployment guides.',
    children: [
      { id: 'docker-fundamentals', parentId: 'docker', name: 'Docker Fundamentals', icon: 'BookOpen', description: 'Core containerization concepts & CLI.' },
      { id: 'docker-images', parentId: 'docker', name: 'Docker Images', icon: 'Layers', description: 'Base images, layers, and Docker Hub.' },
      { id: 'docker-containers', parentId: 'docker', name: 'Docker Containers', icon: 'Box', description: 'Container lifecycle management.' },
      { id: 'dockerfile', parentId: 'docker', name: 'Dockerfile', icon: 'FileCode', description: 'Multi-stage builds and optimization.' },
      { id: 'docker-compose', parentId: 'docker', name: 'Docker Compose', icon: 'Cpu', description: 'Multi-container orchestration.' },
      { id: 'docker-networking', parentId: 'docker', name: 'Docker Networking', icon: 'Share2', description: 'Bridge, host, and overlay networks.' },
      { id: 'docker-volumes', parentId: 'docker', name: 'Docker Volumes', icon: 'HardDrive', description: 'Data persistence and bind mounts.' },
      { id: 'docker-debugging', parentId: 'docker', name: 'Docker Debugging', icon: 'Search', description: 'Container logs and troubleshooting.' },
      { id: 'docker-security', parentId: 'docker', name: 'Docker Security', icon: 'Shield', description: 'Non-root execution and security scanning.' },
      { id: 'docker-production', parentId: 'docker', name: 'Docker Production', icon: 'Server', description: 'Production deployment and hardening.' },
    ],
  },
  {
    id: 'frontend',
    name: 'Frontend (React & Vite)',
    icon: 'Layout',
    description: 'React components, hooks, state management, Vite build optimizations, and production deployment guides.',
    children: [
      { id: 'frontend-react-fundamentals', parentId: 'frontend', name: 'React Fundamentals', icon: 'BookOpen', description: 'React mental model, JSX, and project setup.' },
      { id: 'frontend-react-components', parentId: 'frontend', name: 'React Components', icon: 'Code', description: 'Functional components, composition, and TSX.' },
      { id: 'frontend-props-state', parentId: 'frontend', name: 'Props & State', icon: 'Sliders', description: 'State management, immutability, and state lifting.' },
      { id: 'frontend-react-hooks', parentId: 'frontend', name: 'React Hooks', icon: 'Zap', description: 'useState, useEffect, useMemo, useCallback, useRef, useContext.' },
      { id: 'frontend-events-forms', parentId: 'frontend', name: 'Events & Forms', icon: 'FileText', description: 'Controlled vs uncontrolled components & form submission.' },
      { id: 'frontend-react-rendering', parentId: 'frontend', name: 'React Rendering', icon: 'Layers', description: 'Reconciliation, virtual DOM, and key prop stability.' },
      { id: 'frontend-react-router', parentId: 'frontend', name: 'React Router', icon: 'Share2', description: 'Client-side routing, params, and protected routes.' },
      { id: 'frontend-react-performance', parentId: 'frontend', name: 'React Performance', icon: 'Cpu', description: 'Code splitting, memoization, and bundle optimization.' },
      { id: 'frontend-react-debugging', parentId: 'frontend', name: 'React Debugging', icon: 'Search', description: 'Fixing top 10 React errors and state bugs.' },
      { id: 'frontend-vite-fundamentals', parentId: 'frontend', name: 'Vite Fundamentals', icon: 'Box', description: 'Next-generation ESM dev server and bundler.' },
      { id: 'frontend-vite-cli', parentId: 'frontend', name: 'Vite CLI', icon: 'Terminal', description: 'CLI commands, dev, build, and preview.' },
      { id: 'frontend-vite-config', parentId: 'frontend', name: 'Vite Configuration', icon: 'FileCode', description: 'vite.config.ts, aliases, and dev proxy.' },
      { id: 'frontend-vite-env', parentId: 'frontend', name: 'Vite Environment Variables', icon: 'Shield', description: '.env files, VITE_ prefix, and security rules.' },
      { id: 'frontend-vite-build-deploy', parentId: 'frontend', name: 'Vite Build & Deployment', icon: 'CloudUpload', description: 'Production bundle, dist output, Nginx & CDN.' },
      { id: 'frontend-react-vite-production', parentId: 'frontend', name: 'React + Vite Production', icon: 'CheckCircle', description: 'Production checklist, security, and CI/CD.' },
    ],
  },
  {
    id: 'backend',
    name: 'Backend',
    icon: 'Server',
    description: 'Node.js runtime, API design, environment variables, and database connectors.',
    children: [
      { id: 'backend-node', parentId: 'backend', name: 'Spring Boot / Node.js', icon: 'Cpu', description: 'Backend APIs.' },
    ],
  },
  {
    id: 'cli',
    name: 'CLI & Terminal',
    icon: 'Terminal',
    description: 'PowerShell, Bash shortcuts, process management, and port troubleshooting.',
  },
  {
    id: 'troubleshooting',
    name: 'Error Dictionary',
    icon: 'AlertTriangle',
    description: 'Tra cứu nguyên nhân và giải pháp sửa lỗi hệ thống, HTTP status, terminal error codes.',
  },
];

export const MOCK_ARTICLES: GuideArticle[] = [
  {
    id: 'what-is-iam-role',
    title: 'What is IAM Role?',
    categoryId: 'aws',
    subcategoryId: 'aws-iam',
    tags: ['AWS', 'IAM'],
    difficulty: 'Beginner',
    type: 'concept',
    readingTimeMinutes: 8,
    summary: 'Understand IAM Roles, temporary security credentials, and how they work in AWS to grant programmatic access safely.',
    updatedAt: '2026-08-20',
    architectureDiagram: `[AI Agent] ──> [STS AssumeRole] ──> [Temporary Token] ──> [AWS APIs]`,
    prerequisites: ['AWS IAM Console Access', 'Basic understanding of IAM Identities'],
  },
  {
    id: 'remove-public-ssh-access',
    title: 'Remove Public SSH Access (Port 22 Lockdown)',
    categoryId: 'aws',
    subcategoryId: 'aws-sg',
    tags: ['AWS', 'EC2', 'Security'],
    difficulty: 'Intermediate',
    type: 'runbook',
    readingTimeMinutes: 20,
    summary: 'Secure your EC2 instances by revoking public 0.0.0.0/0 inbound SSH rules and routing management exclusively through AWS SSM.',
    updatedAt: '2026-08-20',
    prerequisites: ['AWS Security Group write permissions', 'SSM Agent Online on EC2'],
  },
  {
    id: 'how-to-connect-ai-agent-to-aws',
    title: 'CONNECTING AN AI AGENT TO AWS — WEB CONSOLE & CLI METHODS (Masterclass Engineering Guide)',
    categoryId: 'aws',
    subcategoryId: 'aws-fundamentals',
    isBookmarked: true,
    tags: ['AWS', 'AI Agent', 'Web Console', 'AWS CLI', 'IAM', 'SSM', 'Security', 'Automation'],
    difficulty: 'Advanced',
    type: 'step_by_step',
    readingTimeMinutes: 20,
    summary: 'Chương tài liệu hướng dẫn chuẩn kiến trúc về hai phương thức kết nối AI Agent với AWS: METHOD A (AWS Management Console - Web UI) cho người mới và METHOD B (AWS CLI / Terminal). Giải thích sâu về Dual Control Plane Architecture, IAM Permissions, SSM Session Manager, CloudWatch Logs, Audit Workflow và Lộ trình học 6 cấp độ (Level 1 → Level 6).',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
           DUAL CONTROL PLANE ARCHITECTURE (HUMAN vs AGENT CONTROL)
================================================================================
                 AWS INFRASTRUCTURE
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
[HUMAN CONTROL PLANE]           [AGENT PROGRAMMATIC PLANE]
  AWS Web Console                     AWS SDK / CLI / Tools
        │                                 │
        ▼                                 ▼
   AWS Web API                       AWS REST API
        │                                 │
        └────────────────┬────────────────┘
                         ▼
                AWS IAM Authorization
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
          AWS APIs                SSM
              │                     │
              ▼                     ▼
        AWS Resources              EC2
                                    │
                               SSM Agent
                                    │
                                    ▼
                               Linux OS

[METHOD A] Web Console: Human UI Control Plane → Configure Identity, Policy, Roles & Approval
[METHOD B] AWS CLI/SDK : Agent Programmatic Plane → Execute Automated Read-Only APIs & SSM`,
    prerequisites: [
      'Tài khoản AWS (AWS Account) đang hoạt động (IAM User hoặc IAM Identity Center)',
      'Region được xác định (vd: ap-southeast-2 Sydney hoặc ap-southeast-1 Singapore)',
      'Trình duyệt Web hỗ trợ truy cập AWS Management Console',
      'Cơ sở dữ liệu EC2 Instance được đính kèm IAM Instance Profile (AmazonSSMManagedInstanceCore)',
      'SSM Agent trên EC2 ở trạng thái Running và PingStatus là Online',
    ],
    managedVsInlineTable: [
      {
        feature: 'Khả năng tái sử dụng (Reusable)',
        managed: 'CÓ (Gán được cho nhiều Users/Groups/Roles)',
        inline: 'KHÔNG (Chỉ đính kèm vào 1 Identity duy nhất)',
      },
      {
        feature: 'Quản lý tập trung (Central Management)',
        managed: 'CÓ (Sửa 1 chỗ, áp dụng tự động cho toàn bộ)',
        inline: 'KHÔNG (Phải vào từng Identity để chỉnh sửa)',
      },
      {
        feature: 'Khuyên dùng cho permissions chung',
        managed: 'CÓ (Tiêu chuẩn quản trị AWS khuyến nghị)',
        inline: 'KHÔNG (Dễ gây rác và khó kiểm soát bảo mật)',
      },
      {
        feature: 'Đính kèm trực tiếp vào Identity',
        managed: 'CÓ',
        inline: 'CÓ',
      },
      {
        feature: 'Phù hợp cho policy đặc thù 1-off',
        managed: 'Thỉnh thoảng',
        inline: 'CÓ',
      },
    ],
    consoleVsCliTable: [
      {
        task: 'Tìm & Kiểm tra EC2 Instance',
        console: 'AWS Console → EC2 → Instances',
        cli: 'aws ec2 describe-instances',
      },
      {
        task: 'Kiểm tra Identity đang đăng nhập',
        console: 'AWS Console → Top-Right Menu (User/Account)',
        cli: 'aws sts get-caller-identity',
      },
      {
        task: 'Kiểm tra IAM Users & Roles',
        console: 'AWS Console → IAM → Roles / Users',
        cli: 'aws iam list-roles / list-users',
      },
      {
        task: 'Kiểm tra trạng thái SSM Managed Node',
        console: 'AWS Console → Systems Manager → Fleet Manager / Managed Nodes',
        cli: 'aws ssm describe-instance-information',
      },
      {
        task: 'Gửi câu lệnh chẩn đoán từ xa',
        console: 'AWS Console → Systems Manager → Run Command (AWS-RunShellScript)',
        cli: 'aws ssm send-command --document-name AWS-RunShellScript',
      },
      {
        task: 'Xem kết quả thực thi lệnh',
        console: 'AWS Console → Run Command → Command History',
        cli: 'aws ssm get-command-invocation',
      },
      {
        task: 'Mở Shell Tương Tác (Interactive)',
        console: 'AWS Console → Systems Manager → Session Manager → Start Session',
        cli: 'aws ssm start-session --target INSTANCE_ID',
      },
      {
        task: 'Kiểm toán Security Group Inbound',
        console: 'AWS Console → EC2 → Security Groups → Inbound rules',
        cli: 'aws ec2 describe-security-groups',
      },
      {
        task: 'Khắc phục lỗi (Sửa Security Group)',
        console: 'AWS Console → Security Groups → Edit inbound rules (🔴 MUTATION)',
        cli: 'aws ec2 revoke-security-group-ingress / authorize-security-group-ingress',
      },
    ],
    learningPath: [
      'LEVEL 1: Learn AWS Management Console (Tự tạo EC2, tạo IAM Role, cấu hình Security Group và xác minh SSM trên Web UI)',
      'LEVEL 2: Learn AWS CLI (Chạy các lệnh describe-instances, send-command, get-command-invocation và start-session trên Terminal)',
      'LEVEL 3: Understand AWS APIs (Hiểu cơ chế IAM authorization, API Request/Response structure và Resource ARNs)',
      'LEVEL 4: Build Agent Tools (Viết các hàm wrapper rời rạc như get_ec2_info(), get_disk_usage(), get_security_groups())',
      'LEVEL 5: Read-Only Agent (Triển khai Agent tự động chẩn đoán, thu thập log và lập báo cáo không sửa đổi hạ tầng)',
      'LEVEL 6: Controlled Remediation Agent (Triển khai Agent đề xuất giải pháp, chờ con người duyệt qua Web/CLI và thực thi khắc phục an toàn)',
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'METHOD A: STEP 1 — Login AWS Management Console',
        description: 'Mở trình duyệt truy cập https://console.aws.amazon.com. Đăng nhập bằng IAM User hoặc IAM Identity Center. KHÔNG BAO GIỜ dùng tài khoản Root cho công việc hàng ngày. Xác minh Account ID ở góc trên bên phải.',
        command: '# CLI Equivalent:\naws sts get-caller-identity',
        expectedOutput: 'Góc trên bên phải Console hiển thị: Account ID (1234-5678-9012) và IAM Identity.',
        tips: 'Mẹo: AWS Management Console và AWS CLI cuối cùng đều gọi AWS REST APIs bên dưới. Console không phải một hệ thống riêng biệt.',
      },
      {
        stepNumber: 2,
        title: 'METHOD A: STEP 2 — Select AWS Region',
        description: 'Vào Region Selector ở góc trên bên phải thanh điều hướng AWS Console. Chọn đúng Region nơi đặt tài nguyên (vd: ap-southeast-2 Sydney hoặc ap-southeast-1 Singapore).',
        command: '# CLI Equivalent:\naws configure get region',
        expectedOutput: 'Region Selector hiển thị đúng Sydney (ap-southeast-2).',
        tips: '⚠️ WARNING: Lỗi phổ biến nhất của người mới là EC2 nằm ở ap-southeast-2 nhưng Console lại chọn us-east-1 dẫn đến việc tài nguyên "bị biến mất". Luôn kiểm tra Region trước!',
      },
      {
        stepNumber: 3,
        title: 'METHOD A: STEP 3 — Create IAM Identity for Agent',
        description: 'Vào AWS Console → IAM → Users → Add user. Đặt tên user: cloud-ai-agent-dev. Đối với môi trường LAB: Tạo IAM User. Đối với PRODUCTION: Khuyến nghị dùng IAM Role / Temporary Credentials.',
        command: '# CLI Equivalent:\naws iam create-user --user-name cloud-ai-agent-dev',
        expectedOutput: 'IAM User cloud-ai-agent-dev được tạo thành công trên Web Console.',
        tips: 'Không khuyến nghị tạo long-lived static access keys cho môi trường Production.',
      },
      {
        stepNumber: 4,
        title: 'METHOD A: STEP 4 — Create Read-Only IAM Policy (JSON)',
        description: 'Vào IAM → Policies → Create policy → Chọn tab JSON. Dán cấu hình Read-Only Policy không có wildcard * nguy hiểm. Đặt tên policy: CloudAgent-ReadOnly.',
        command: 'cat << "EOF" > agent-readonly-policy.json\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Effect": "Allow",\n      "Action": [\n        "ec2:DescribeInstances",\n        "ec2:DescribeVolumes",\n        "ec2:DescribeSecurityGroups",\n        "ec2:DescribeNetworkInterfaces",\n        "ssm:DescribeInstanceInformation"\n      ],\n      "Resource": "*"\n    }\n  ]\n}\nEOF',
        expectedOutput: 'Managed Policy CloudAgent-ReadOnly được khởi tạo thành công.',
        tips: 'An toàn hơn nhiều so với việc gán nhầm AdministratorAccess.',
      },
      {
        stepNumber: 5,
        title: 'METHOD A: STEP 5 — Attach Policy to Agent (Direct or Group)',
        description: 'METHOD 1 (Trực tiếp): IAM → Users → cloud-ai-agent-dev → Permissions → Add permissions → Add permissions directly → Chọn CloudAgent-ReadOnly. METHOD 2 (Group khuyên dùng): IAM → User groups → Create group → Gán policy vào Group → Thêm User vào Group.',
        command: '# CLI Equivalent:\naws iam attach-user-policy --user-name cloud-ai-agent-dev --policy-arn arn:aws:iam::ACCOUNT:policy/CloudAgent-ReadOnly',
        expectedOutput: 'Policy CloudAgent-ReadOnly hiển thị dưới danh sách Attached Policies của User/Group.',
      },
      {
        stepNumber: 6,
        title: 'METHOD A: STEP 6 — Create / Verify EC2 Instance',
        description: 'Vào AWS Console → EC2 → Instances. Kiểm tra các thông số: Instance ID (i-xxx), State (Running), Private/Public IPv4, Subnet, Security Group và IAM Role.',
        command: '# CLI Equivalent:\naws ec2 describe-instances',
        expectedOutput: 'Instance hiển thị trạng thái Running trên Web Console.',
      },
      {
        stepNumber: 7,
        title: 'METHOD A: STEP 7 — Configure EC2 IAM Role for SSM',
        description: 'Vào IAM → Roles → Create role → Trusted entity: AWS service (EC2). Attach Policy: AmazonSSMManagedInstanceCore. Đặt tên role: EC2-CloudEngineer-Lab-Role. Quay lại EC2 → Instances → Chọn Instance → Actions → Security → Modify IAM role → Chọn EC2-CloudEngineer-Lab-Role.',
        command: '# CLI Equivalent:\naws ec2 associate-iam-instance-profile --instance-id i-xxx --iam-instance-profile Name=EC2-CloudEngineer-Lab-Role',
        expectedOutput: 'Cập nhật thành công IAM Role cho EC2 Instance.',
      },
      {
        stepNumber: 8,
        title: 'METHOD A: STEP 8 — Verify SSM Managed Node',
        description: 'Vào AWS Console → Systems Manager → Fleet Manager (hoặc Managed Nodes). Tìm Instance ID i-xxx và kiểm tra thông số: PingStatus = Online, Platform = Linux, Agent Version.',
        command: '# CLI Equivalent:\naws ssm describe-instance-information',
        expectedOutput: 'Hiển thị badge màu xanh PingStatus = Online.',
        tips: 'Các trạng thái có thể gặp: Online (Hoạt động tốt), Connection Lost (Mất mạng tạm thời), Offline/Unavailable (Thiếu IAM Role hoặc SSM Agent tắt).',
      },
      {
        stepNumber: 9,
        title: 'METHOD A: STEP 9 — Open Session Manager (Web Shell)',
        description: 'Vào AWS Console → Systems Manager → Session Manager → Sessions → Start session. Chọn EC2 Instance -> Click Start session. Một cửa sổ Web Shell sẽ mở ra trực tiếp trên trình duyệt.',
        command: '# CLI Equivalent:\naws ssm start-session --target i-0123456789abcdef0',
        expectedOutput: 'Giao diện terminal sh-5.2$ hiển thị trên trình duyệt Web.',
        tips: 'Không cần file SSH Private Key (.pem), Không cần mở Port 22 SSH công khai trên Inbound Security Group!',
      },
      {
        stepNumber: 10,
        title: 'METHOD A: STEP 10 — Run Read-Only Diagnostics via Web UI',
        description: 'CÁCH 1: Thực thi trực tiếp trên Session Manager Web Shell các lệnh 🟢 READ-ONLY: df -h, free -m, uptime, ss -lntup. CÁCH 2: Vào Systems Manager → Run Command → Run a command → Chọn AWS-RunShellScript → Chọn Instance → Nhập df -h → Run. Xem kết quả ở Command History.',
        command: '# CLI Equivalent:\naws ssm send-command --instance-ids "i-xxx" --document-name "AWS-RunShellScript" --parameters \'commands=["df -h"]\'',
        expectedOutput: 'Command History hiển thị Status: Success và kết quả dung lượng ổ đĩa.',
      },
      {
        stepNumber: 11,
        title: 'METHOD A: STEP 11 — CloudWatch / Logs Inspection',
        description: 'Vào Systems Manager → Session Manager → Preferences để cấu hình đẩy log phiên làm việc sang CloudWatch Logs hoặc S3 Bucket. Phân biệt: Session Logging (ghi lại thao tác terminal) vs CloudTrail API Auditing (ghi lại API calls).',
        command: '# CLI Equivalent:\naws logs describe-log-groups',
        expectedOutput: 'Các log streams ghi nhận lại toàn bộ thao tác chẩn đoán của Agent/Developer.',
      },
      {
        stepNumber: 12,
        title: 'METHOD A: STEP 12 — Security Group Audit via Web Console',
        description: 'Vào EC2 → Instances → Select instance → Tab Security → Click Security Group ID. Kiểm tra danh sách Inbound rules. Phát hiện Rule: TCP / Port 22 / Source 0.0.0.0/0 -> Phân loại 🔴 HIGH RISK. TUYỆT ĐỐI KHÔNG sửa ngay lúc audit. Audit trước, ghi nhận bằng chứng!',
        command: '# CLI Equivalent:\naws ec2 describe-security-groups --group-ids sg-xxx',
        expectedOutput: 'Ghi nhận được bằng chứng lỗ hổng mở SSH 0.0.0.0/0 trên Web UI.',
      },
      {
        stepNumber: 13,
        title: 'METHOD A: STEP 13 — Human Approval Interface',
        description: 'Agent xuất báo cáo rủi ro: Finding, Evidence, Risk, Recommendation, Proposed Change. Administrator sử dụng AWS Console làm Giao diện Duyệt (Human Approval Interface) để xác nhận đề xuất trước khi sửa.',
        command: '# Agent Log:\nProposed Fix: Delete Inbound Rule SSH TCP/22 0.0.0.0/0. Awaiting Human Approval via AWS Console...',
        expectedOutput: 'Con người duyệt phương án sửa đổi trên Web Console.',
      },
      {
        stepNumber: 14,
        title: 'METHOD A: STEP 14 — Web Console Remediation (Controlled Mutation)',
        description: 'Sau khi được duyệt, vào EC2 → Security Groups → Chọn SG → Tab Inbound rules → Edit inbound rules → Xóa dòng SSH 0.0.0.0/0 → Save rules. Đánh dấu hành động: 🔴 MUTATION. Trước khi xóa, đảm bảo SSM Session Manager vẫn hoạt động bình thường.',
        command: '# CLI Equivalent:\naws ec2 revoke-security-group-ingress --group-id sg-xxx --protocol tcp --port 22 --cidr 0.0.0.0/0',
        expectedOutput: 'Inbound rule 0.0.0.0/0 trên port 22 đã được gỡ bỏ khỏi Security Group.',
      },
      {
        stepNumber: 15,
        title: 'METHOD A: STEP 15 — Verify After Remediation via Web UI',
        description: 'Vào lại Security Group Inbound Rules → Xác nhận không còn Port 22 0.0.0.0/0. Vào Systems Manager → Managed Nodes → Xác nhận PingStatus = Online. Mở Session Manager → Start Session → Xác nhận quyền quản trị vẫn hoạt động qua SSM.',
        command: '# CLI Equivalent:\naws ec2 describe-security-groups --group-ids sg-xxx',
        expectedOutput: 'Xác minh hoàn tất 100%. Quản trị an toàn qua SSM thành công!',
      },
      {
        stepNumber: 16,
        title: 'METHOD B: AWS CLI / TERMINAL WORKFLOW (Retained CLI Method)',
        description: 'Thực hiện toàn bộ 15 bước tương đương bằng Terminal / AWS CLI v2: aws sts get-caller-identity -> aws iam create-policy -> aws iam attach-user-policy -> aws ec2 associate-iam-instance-profile -> aws ssm describe-instance-information -> aws ssm send-command -> aws ssm start-session.',
        command: 'aws ssm start-session --target i-0123456789abcdef0',
        expectedOutput: 'Kết nối SSM thành công qua CLI.',
        tips: 'Tham khảo thêm bài viết AWS CLI Cheatsheet trong DCC để nắm vững toàn bộ cú pháp lệnh Terminal.',
      },
    ],
    checklist: [
      'Login AWS Management Console successfully (IAM User/Identity Center)',
      'Region verified in Top-Right Selector (e.g. ap-southeast-2 Sydney)',
      'IAM Identity created for Agent (User for Lab, Role for Prod)',
      'CloudAgent-ReadOnly IAM Policy created via JSON editor',
      'Policy attached via Direct Attach or User Group',
      'EC2 Instance status confirmed Running',
      'IAM Role with AmazonSSMManagedInstanceCore attached to EC2',
      'SSM Agent verified running on EC2 Instance',
      'Systems Manager Managed Node confirmed PingStatus = Online',
      'Session Manager Web Shell connection verified without Port 22',
      'Read-Only diagnostic commands executed (df -h, free -m, uptime)',
      'Systems Manager Run Command (AWS-RunShellScript) output inspected',
      'CloudWatch Logs & Session Logging preferences configured',
      'Security Group audited and HIGH RISK SSH 0.0.0.0/0 rule identified',
      'Agent report produced with Finding, Evidence, Risk, and Recommendation',
      'Human Approval performed via AWS Management Console interface',
      'Security Group remediation performed (SSH 0.0.0.0/0 removed)',
      'Post-remediation verification confirmed SSM Managed Node Online',
      'Session Manager interactive shell re-tested after remediation',
      'Rollback procedure documented if SSH access is temporarily required',
    ],
    labVsProdTable: [
      {
        area: 'Identity Type',
        lab: 'IAM User / Static Access Key Profile',
        prod: 'IAM Role / AWS STS Temporary Credentials / OIDC',
      },
      {
        area: 'Permission Boundary',
        lab: 'Read-Only Policy (EC2/SSM Describe)',
        prod: 'Strict Least-Privilege + Resource-level ARNs',
      },
      {
        area: 'Credentials Storage',
        lab: 'Local Profile (~/.aws/credentials)',
        prod: 'KMS Encrypted Vault / IAM Instance Profile / Secrets Manager',
      },
      {
        area: 'EC2 Access Pathway',
        lab: 'AWS SSM Session Manager',
        prod: 'AWS SSM Session Manager (Zero Public Inbound SSH)',
      },
      {
        area: 'SSH Port 22',
        lab: 'Restricted IP or Restricted for Learning',
        prod: 'Port 22 Fully Blocked (SSM Proxy Only)',
      },
      {
        area: 'Agent Execution Environment',
        lab: 'Local Workstation / Dev Machine',
        prod: 'Isolated Worker Container / Controlled Sandbox',
      },
      {
        area: 'Remediation Action',
        lab: 'Manual Confirmation via CLI / Web Console',
        prod: 'Strong Multi-Party Human Approval Workflow',
      },
      {
        area: 'Audit & Compliance',
        lab: 'Local Terminal / Console History Logs',
        prod: 'Centralized AWS CloudTrail + CloudWatch Logs + S3',
      },
    ],
    commonErrors: [
      {
        errorCode: 'Resource appears missing on AWS Web Console',
        cause: 'Đang xem sai AWS Region trên Region Selector góc trên bên phải (vd: EC2 ở ap-southeast-2 nhưng đang mở us-east-1).',
        solution: 'Chuyển Region Selector trên thanh tiêu đề Console sang đúng Region của EC2 Instance.',
        commandFix: 'Check Top-Right Navigation Bar -> Select ap-southeast-2',
      },
      {
        errorCode: 'SSM Fleet Manager / Managed Nodes displays PingStatus: Connection Lost or Offline',
        cause: 'EC2 Instance thiếu IAM Role (AmazonSSMManagedInstanceCore), hoặc SSM Agent service trên Linux bị ngắt.',
        solution: 'Vào EC2 → Actions → Security → Modify IAM role → Gán EC2-CloudEngineer-Lab-Role.',
        commandFix: 'aws ec2 associate-iam-instance-profile --instance-id i-xxx --iam-instance-profile Name=EC2-CloudEngineer-Lab-Role',
      },
      {
        errorCode: 'Session Manager Start Session button is disabled (Grayed Out)',
        cause: 'Target Instance chưa được đăng ký làm Managed Node trong AWS Systems Manager.',
        solution: 'Gán IAM Role chứa policy AmazonSSMManagedInstanceCore vào EC2 và chờ 1-2 phút cho SSM Agent ping về.',
        commandFix: 'aws ssm describe-instance-information',
      },
      {
        errorCode: 'AccessDenied: User is not authorized to perform ssm:StartSession',
        cause: 'IAM User/Role của Agent hoặc Developer chưa được đính kèm Policy cấp quyền ssm:StartSession.',
        solution: 'Vào IAM Console → Users → Select user → Add permissions → Gán Policy chứa ssm:StartSession.',
        commandFix: 'aws iam attach-user-policy --user-name cloud-ai-agent-dev --policy-arn arn:aws:iam::aws:policy/AmazonSSMFullAccess',
      },
    ],
    securityRules: [
      'NEVER USE ROOT CREDENTIALS: Tuyệt đối không dùng root access key hay root login cho công việc hàng ngày.',
      'PREFER TEMPORARY CREDENTIALS IN PRODUCTION: Sử dụng AWS STS assume-role hoặc IAM Identity Center thay cho static access key.',
      'APPLY LEAST PRIVILEGE: Chỉ cấp đúng các Action cần thiết (ec2:Describe*, ssm:Describe*). Không dùng wildcard *.',
      'SEPARATE READ-ONLY AND MUTATION PERMISSIONS: Tách biệt hoàn toàn IAM Policy chẩn đoán đọc (Read-only) và Policy thay đổi (Mutation).',
      'SEPARATE ENVIRONMENTS: Tách biệt môi trường Development/Staging và Production bằng các AWS Account / IAM Roles riêng.',
      'REQUIRE HUMAN APPROVAL FOR DESTRUCTIVE OPERATIONS: Bắt buộc có bước duyệt trực tiếp từ con người (Human-in-the-loop) qua Web Console / CLI trước khi xóa hoặc dừng tài nguyên.',
      'LOG AGENT ACTIONS: Bật AWS CloudTrail và CloudWatch Logs để ghi lại toàn bộ API calls và SSM commands do Agent thực thi.',
      'AUDIT IAM PERMISSIONS REGULARLY: Thường xuyên rà soát IAM Policies bằng AWS IAM Access Analyzer.',
      'NEVER EXPOSE CREDENTIALS TO LLM PROMPTS: Không đưa Access Key, Secret Key hay Tokens vào Prompt context gửi tới LLM APIs.',
      'NEVER HARD-CODE SECRETS: Dùng Environment Variables, AWS Secrets Manager, hoặc IAM Instance Profiles.',
      'PREFER SSM OVER PUBLICLY EXPOSED SSH: Sử dụng AWS SSM Session Manager thay cho việc mở Port 22 SSH công khai trên Internet.',
      'ALWAYS VERIFY REMEDIATION: Sau khi thực hiện lệnh sửa lỗi, bắt buộc phải chạy lệnh kiểm tra lại (Verification step).',
      'MAINTAIN ROLLBACK PROCEDURES: Luôn chuẩn bị sẵn quy trình và kịch bản khôi phục (Rollback) trước khi thay đổi cấu hình hạ tầng.',
    ],
    onePageCheatSheet: `================================================================================
          CONNECTING AN AI AGENT TO AWS — DUAL METHOD MASTER CHEAT SHEET
================================================================================

[METHOD A — AWS MANAGEMENT CONSOLE (WEB UI VERSION)]
1. LOGIN            : Access https://console.aws.amazon.com -> Verify Account ID (Top-Right).
2. REGION SELECT    : Select target Region (e.g. ap-southeast-2 Sydney) in Top Navigation.
3. AGENT IDENTITY   : IAM -> Users -> Create user "cloud-ai-agent-dev".
4. CREATE POLICY    : IAM -> Policies -> Create policy -> JSON -> Paste Read-Only Policy -> Save "CloudAgent-ReadOnly".
5. ATTACH POLICY    : IAM -> User groups -> Create group -> Attach "CloudAgent-ReadOnly" -> Add user.
6. PREPARE EC2      : EC2 -> Instances -> Select instance -> Verify State: Running.
7. ATTACH EC2 ROLE  : IAM -> Roles -> Create role (EC2 service + AmazonSSMManagedInstanceCore) -> EC2 -> Modify IAM Role.
8. VERIFY SSM       : Systems Manager -> Fleet Manager / Managed Nodes -> Confirm PingStatus: Online.
9. OPEN SESSION     : Systems Manager -> Session Manager -> Start Session (Zero open Port 22 SSH).
10. READ-ONLY AUDIT : Session Manager Web Shell OR Systems Manager -> Run Command (AWS-RunShellScript "df -h").
11. LOGGING & AUDIT : Systems Manager -> Session Manager -> Preferences -> Enable CloudWatch Logs / S3 logging.
12. SECURITY AUDIT  : EC2 -> Security Groups -> Inspect Inbound Rules -> Identify TCP 22 0.0.0.0/0 (🔴 HIGH RISK).
13. HUMAN APPROVAL  : Agent outputs Finding & Proposal -> Human reviews and approves via AWS Web Console.
14. REMEDIATION     : EC2 -> Security Groups -> Edit Inbound Rules -> Delete SSH 0.0.0.0/0 -> Save (🔴 MUTATION).
15. VERIFICATION    : Systems Manager -> Managed Nodes (Online) -> Session Manager -> Start Session -> Verified!

--------------------------------------------------------------------------------

[METHOD B — AWS CLI / TERMINAL VERSION]
1. IDENTITY VERIFY  : aws sts get-caller-identity
2. CREATE POLICY    : aws iam create-policy --policy-name CloudAgent-ReadOnly --policy-document file://policy.json
3. ATTACH USER POL  : aws iam attach-user-policy --user-name cloud-ai-agent-dev --policy-arn arn:aws:iam::ACCOUNT:policy/CloudAgent-ReadOnly
4. ATTACH EC2 ROLE  : aws ec2 associate-iam-instance-profile --instance-id i-xxx --iam-instance-profile Name=EC2-SSM-Role
5. VERIFY SSM NODE  : aws ssm describe-instance-information --output table
6. RUN DIAGNOSTICS  : aws ssm send-command --instance-ids "i-xxx" --document-name "AWS-RunShellScript" --parameters 'commands=["df -h"]'
7. INTERACTIVE SSH  : aws ssm start-session --target i-0123456789abcdef0
8. SECURITY AUDIT   : aws ec2 describe-security-groups --group-ids sg-xxx
9. REMEDIATION      : aws ec2 revoke-security-group-ingress --group-id sg-xxx --protocol tcp --port 22 --cidr 0.0.0.0/0
10. VERIFY POST FIX : aws ec2 describe-security-groups --group-ids sg-xxx
================================================================================`,
  },
  {
    id: 'aws-cli-iam-agent-setup',
    title: 'Cấu Hình AWS CLI v2, IAM User & Custom Policy Cho AI Agents (Antigravity/Codex)',
    categoryId: 'aws',
    subcategoryId: 'aws-iam',
    isBookmarked: true,
    tags: ['AWS', 'AWS CLI', 'IAM', 'IAM Policy', 'SSM', 'Security', 'AI Agent'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    summary: 'Hướng dẫn chi tiết từng bước thiết lập AWS CLI v2, định nghĩa IAM JSON Policy theo nguyên tắc Least Privilege, gán quyền cho IAM User/Role, và kết nối EC2 an toàn qua AWS Systems Manager (SSM) không cần mở Port 22.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 10,
    steps: [
      {
        stepNumber: 1,
        title: 'Khởi Tạo & Kiểm Tra AWS CLI v2 Profile',
        description: 'Cài đặt AWS CLI v2 trên máy cục bộ và thiết lập Named Profile chuyên dụng cho AI Agent với Access Key và Secret Key.',
        command: 'aws configure --profile ai-agent-profile\n# AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE\n# AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY\n# Default region name [None]: ap-southeast-1\n# Default output format [None]: json',
        expectedOutput: 'Tạo thành công credential profile tại ~/.aws/credentials.',
        tips: 'Kiểm tra lại thông tin identity bằng lệnh: aws sts get-caller-identity --profile ai-agent-profile',
      },
      {
        stepNumber: 2,
        title: 'Tạo File JSON IAM Policy Cho AI Agent (Least Privilege)',
        description: 'Định nghĩa quyền hạn tối thiểu: Chỉ cấp quyền thao tác EC2 (Read/Start/Stop) và kết nối qua SSM Session Manager mà không cho phép truy cập tài nguyên nhạy cảm khác.',
        command: 'cat << "EOF" > ai-agent-policy.json\n{\n  "Version": "2012-10-17",\n  "Statement": [\n    {\n      "Sid": "EC2ReadAndManage",\n      "Effect": "Allow",\n      "Action": [\n        "ec2:DescribeInstances",\n        "ec2:DescribeSecurityGroups",\n        "ec2:StartInstances",\n        "ec2:StopInstances"\n      ],\n      "Resource": "*"\n    },\n    {\n      "Sid": "SSMSessionManagerConnect",\n      "Effect": "Allow",\n      "Action": [\n        "ssm:StartSession",\n        "ssm:TerminateSession",\n        "ssm:ResumeSession",\n        "ssm:DescribeSessions"\n      ],\n      "Resource": "*"\n    }\n  ]\n}\nEOF',
        expectedOutput: 'Tạo thành công file JSON policy ai-agent-policy.json.',
        tips: 'Tuân thủ tuyệt đối nguyên tắc Least Privilege (Quyền tối thiểu) để đảm bảo an toàn nếu API Key bị rò rỉ.',
      },
      {
        stepNumber: 3,
        title: 'Tạo IAM Policy & Đính Kèm Vào IAM User/Role Bằng AWS CLI',
        description: 'Khởi chạy lệnh tạo Managed Policy trên AWS IAM và gán Policy vừa tạo vào IAM User/Role dành riêng cho AI Agent.',
        command: 'aws iam create-policy --policy-name AIAgentMinimalPolicy --policy-document file://ai-agent-policy.json --profile ai-agent-profile\n\naws iam attach-user-policy --user-name antigravity-agent-user --policy-arn arn:aws:iam::ACCOUNT_ID:policy/AIAgentMinimalPolicy --profile ai-agent-profile',
        expectedOutput: 'PolicyArn được khởi tạo và đính kèm thành công vào IAM User antigravity-agent-user.',
      },
      {
        stepNumber: 4,
        title: 'Kết Nối EC2 Không Cần Port 22 Bằng AWS SSM Session Manager',
        description: 'Kết nối trực tiếp vào EC2 qua AWS CLI SSM Session Manager Plugin hoặc cấu hình SSH ProxyCommand trong ~/.ssh/config để Antigravity/Codex kết nối tự động.',
        command: 'aws ssm start-session --target i-0123456789abcdef0 --profile ai-agent-profile\n\n# Hoặc mở Port Forwarding Tunnel qua SSM:\naws ssm start-session --target i-0123456789abcdef0 --document-name AWS-StartPortForwardingSession --parameters \'{"portNumber":["8080"],"localPortNumber":["8080"]}\' --profile ai-agent-profile',
        expectedOutput: 'Mở thành công phiên kết nối tương tác SSH/SSM không cần mở Inbound Port 22 trên Security Group.',
        tips: 'Cấu hình ProxyCommand aws ssm start-session trong ~/.ssh/config để các IDE/AI Agent coi EC2 SSM như một SSH host thông thường.',
      },
    ],
  },
  {
    id: 'aws-cli-iam-command-cheatsheet',
    title: 'AWS CLI v2 & IAM Management Command Cheatsheet',
    categoryId: 'aws',
    subcategoryId: 'aws-fundamentals',
    tags: ['AWS CLI', 'IAM', 'EC2', 'SSM', 'CLI Commands', 'Cheatsheet'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    summary: 'Tổng hợp các câu lệnh AWS CLI thông dụng nhất cho Developer: Kiểm tra Identity, Quản lý IAM User/Policy, Bật/Tắt EC2 tiết kiệm chi phí, và SSH Over SSM.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 6,
    snippets: [
      {
        language: 'bash',
        code: 'aws sts get-caller-identity --profile ai-agent-profile',
        description: 'Kiểm tra IAM User, Account ID và ARN hiện tại đang đăng nhập qua AWS CLI',
      },
      {
        language: 'bash',
        code: 'aws ec2 describe-instances --filters "Name=instance-state-name,Values=running" --query "Reservations[*].Instances[*].[InstanceId,InstanceType,PublicIpAddress,Tags[?Key==\'Name\'].Value|[0]]" --output table',
        description: 'Liệt kê danh sách các EC2 Instance đang chạy kèm theo Public IP và Name Tag dưới dạng bảng',
      },
      {
        language: 'bash',
        code: 'aws ec2 stop-instances --instance-ids i-0123456789abcdef0 --profile ai-agent-profile',
        description: 'Tắt EC2 Instance khi không sử dụng để tiết kiệm chi phí tính phí theo giờ của AWS',
      },
      {
        language: 'bash',
        code: 'aws ec2 start-instances --instance-ids i-0123456789abcdef0 --profile ai-agent-profile',
        description: 'Bật lại EC2 Instance để chuẩn bị cho AI Agent làm việc',
      },
      {
        language: 'bash',
        code: 'aws iam list-attached-user-policies --user-name antigravity-agent-user --profile ai-agent-profile',
        description: 'Kiểm tra danh sách các IAM Policy đang được đính kèm vào User',
      },
      {
        language: 'text',
        code: `# Thêm cấu hình SSH over SSM vào ~/.ssh/config:
Host ec2-ssm-agent
  HostName i-0123456789abcdef0
  User ubuntu
  IdentityFile ~/.ssh/aws-ec2-key.pem
  ProxyCommand aws ssm start-session --target %h --document-name AWS-StartSSHSession --parameters portNumber=%p --profile ai-agent-profile`,
        description: 'Cấu hình SSH ProxyCommand trong ~/.ssh/config để Antigravity/Codex kết nối EC2 qua SSM',
      },
    ],
  },
  {
    id: 'aws-ec2-agent-connect',
    title: 'Hướng Dẫn Kết Nối AWS EC2 với Antigravity & AI Coding Agents qua Remote SSH',
    categoryId: 'aws',
    subcategoryId: 'aws-ec2',
    tags: ['AWS', 'EC2', 'Antigravity', 'Codex', 'Remote SSH', 'AI Agent'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    summary: 'Quy trình chuẩn từng bước thiết lập AWS EC2 Instance, phân quyền SSH Key Pair, mở Inbound Rules, và cấu hình Antigravity / Codex Agent làm việc từ xa.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 9,
    steps: [
      {
        stepNumber: 1,
        title: 'Tạo AWS EC2 Instance & Tải SSH Key Pair (.pem)',
        description: 'Vào AWS Management Console -> EC2 -> Launch Instance. Chọn OS (Ubuntu 22.04 LTS hoặc Amazon Linux 2023), chọn Instance Type (t3.medium trở lên được khuyến nghị cho AI Workloads). Tạo mới và tải về file Private Key `aws-ec2-key.pem`.',
        command: 'chmod 400 ~/.ssh/aws-ec2-key.pem',
        expectedOutput: 'File PEM được thiết lập quyền chỉ đọc (Read-only for owner).',
        tips: 'Trên Windows PowerShell, sử dụng lệnh icacls để hạ quyền ghi của file .pem nhằm tránh lỗi SSH Security Warning.',
      },
      {
        stepNumber: 2,
        title: 'Cấu hình AWS Security Group (Inbound Rules)',
        description: 'Tại mục Security Groups của EC2: Thêm Inbound Rule cho SSH (Port 22, Source: My IP hoặc 0.0.0.0/0). Nếu AI Agent cần kết nối API Server/Language Server từ xa, hãy mở bổ sung Custom TCP Port (vd: Port 8080 hoặc 3000).',
        command: 'aws ec2 authorize-security-group-ingress --group-id sg-xxxxxx --protocol tcp --port 22 --cidr 0.0.0.0/0',
        expectedOutput: 'Security group rule added successfully.',
        tips: 'Khuyến nghị chỉ giới hạn IP nhà/công ty của bạn thay vì mở 0.0.0.0/0 để đạt tiêu chuẩn an toàn bảo mật AWS.',
      },
      {
        stepNumber: 3,
        title: 'Cấu hình SSH Config File (~/.ssh/config)',
        description: 'Thêm cấu hình Host Alias trong file config máy cục bộ để Antigravity / Codex Agent nhận diện kết nối tự động mà không cần gõ lại IP.',
        command: "cat << 'EOF' >> ~/.ssh/config\nHost aws-ec2-agent\n  HostName 13.212.xx.xx\n  User ubuntu\n  IdentityFile ~/.ssh/aws-ec2-key.pem\n  ServerAliveInterval 60\n  ServerAliveCountMax 10\nEOF",
        expectedOutput: 'Thêm alias Host aws-ec2-agent vào file ~/.ssh/config thành công.',
        tips: 'ServerAliveInterval giúp duy trì kết nối SSH ổn định không bị đứt giữa chừng khi AI Agent đang xử lý tác vụ dài.',
      },
      {
        stepNumber: 4,
        title: 'Khởi động Remote Agent Daemon & Port Forwarding',
        description: 'Kết nối SSH tới EC2 và cài đặt Node.js/Python environment. Khởi chạy Antigravity Language Server / Codex Daemon trong background session (tmux/screen) để Agent duy trì hoạt động.',
        command: 'ssh aws-ec2-agent -L 8080:localhost:8080 "tmux new -s agent-session -d \'antigravity --listen 8080\'"',
        expectedOutput: 'SSH Tunnel mở thành công và Antigravity Agent Daemon đang lắng nghe trên EC2.',
        tips: 'Sử dụng Remote SSH Extension hoặc Antigravity Connection Manager để đính kèm workspace trên EC2 vào giao diện DCC.',
      },
    ],
  },
  {
    id: 'aws-ec2-ssh-cheatsheet',
    title: 'AWS EC2 & AI Agent Remote SSH Cheatsheet',
    categoryId: 'aws',
    subcategoryId: 'aws-ssm',
    tags: ['AWS', 'EC2', 'SSH Tunnel', 'CLI', 'Port Forwarding'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    summary: 'Tổng hợp các câu lệnh Terminal kết nối EC2, thiết lập SSH Tunnel cho API Agent, và quản lý tiến trình ngầm bằng tmux.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 5,
    snippets: [
      {
        language: 'bash',
        code: 'ssh -i ~/.ssh/aws-ec2-key.pem ubuntu@ec2-13-212-xx-xx.ap-southeast-1.compute.amazonaws.com',
        description: 'Kết nối SSH trực tiếp tới AWS EC2 Instance (Ubuntu)',
      },
      {
        language: 'bash',
        code: 'ssh -L 8080:localhost:8080 -N -f -i ~/.ssh/aws-ec2-key.pem ubuntu@ec2-ip',
        description: 'Tạo SSH Tunnel đẩy Port 8080 từ EC2 về Local Machine cho AI Agent API',
      },
      {
        language: 'powershell',
        code: 'icacls ~/.ssh/aws-ec2-key.pem /inheritance:r /grant:r "$($env:USERNAME):(R)"',
        description: 'Sửa lỗi phân quyền file .pem trên Windows PowerShell',
      },
      {
        language: 'bash',
        code: 'tmux new-session -d -s agent_worker "node server.js"',
        description: 'Khởi chạy AI Agent worker ngầm trong tmux session',
      },
      {
        language: 'bash',
        code: 'tmux ls && tmux attach -t agent_worker',
        description: 'Xem và kết nối lại vào session AI Agent đang chạy trên EC2',
      },
    ],
  },
  {
    id: 'aws-ec2-troubleshoot-errors',
    title: 'Tra Cứu & Sửa Lỗi Kết Nối AWS EC2 Thường Gặp',
    categoryId: 'aws',
    subcategoryId: 'aws-sg',
    tags: ['AWS', 'EC2', 'SSH', 'Troubleshooting', 'Errors'],
    difficulty: 'Intermediate',
    type: 'troubleshoot',
    summary: 'Danh mục tra cứu nguyên nhân và câu lệnh sửa lỗi SSH EC2: Permission denied (publickey), Connection timed out, Host key verification failed.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 6,
    commonErrors: [
      {
        errorCode: 'Permission denied (publickey,gssapi-keyex,gssapi-with-mic)',
        cause: 'Dùng sai User name (vd: Ubuntu dùng ec2-user thay vì ubuntu) hoặc SSH Key file .pem chưa được phân quyền đúng 400.',
        solution: 'Kiểm tra đúng User theo OS (Ubuntu: ubuntu, Amazon Linux: ec2-user, CentOS: centos) và sửa lại quyền file .pem.',
        commandFix: 'chmod 400 ~/.ssh/aws-ec2-key.pem && ssh -i ~/.ssh/aws-ec2-key.pem ubuntu@ec2-ip',
      },
      {
        errorCode: 'ssh: connect to host ec2-xx-xx.amazonaws.com port 22: Connection timed out',
        cause: 'AWS Security Group chưa mở Inbound Rule Port 22, hoặc Instance chưa có Elastic IP / Public IP address.',
        solution: 'Vào AWS Console -> EC2 -> Security Groups -> Edit Inbound Rules -> Thêm Type: SSH, Port: 22, Source: My IP.',
        commandFix: 'aws ec2 describe-instance-status --instance-ids i-xxxxxx',
      },
      {
        errorCode: 'WARNING: UNPROTECTED PRIVATE KEY FILE! Bad permissions on key',
        cause: 'File .pem có quyền truy cập quá rộng (khách hoặc user khác trên máy có thể đọc/ghi).',
        solution: 'Tải lại quyền hạn file key để SSH client chấp nhận kết nối.',
        commandFix: 'chmod 600 ~/.ssh/aws-ec2-key.pem',
      },
      {
        errorCode: 'Host key verification failed. Remote host identification has changed!',
        cause: 'IP hoặc Hostname của EC2 được cấp lại sau khi Reboot / Stop-Start, khiến Fingerprint bị lệch so với file known_hosts cũ.',
        solution: 'Xóa dòng IP cũ khỏi file known_hosts bằng lệnh ssh-keygen.',
        commandFix: 'ssh-keygen -R 13.212.xx.xx',
      },
    ],
  },
  {
    id: 'git-cli-command-cheatsheet',
    title: 'Git CLI Command Cheatsheet (Daily Operations & Disaster Recovery Essentials)',
    categoryId: 'git',
    subcategoryId: 'git-fundamentals',
    isBookmarked: true,
    tags: ['Git', 'CLI', 'DevOps', 'Cheatsheet', 'Staging', 'Branching', 'Rebase', 'Recovery'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    readingTimeMinutes: 10,
    summary: 'Tra cứu nhanh toàn bộ câu lệnh Git CLI từ cơ bản tới nâng cao: Khởi tạo, Staging, Commit, Branching (prefer git switch), Merge vs Rebase, Push/Remote, History Inspection, Stash, Tags (SemVer), Undo (restore/reset/revert), Recovery (reflog), Cherry-pick và Conflict Resolution.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'bash',
        code: 'git --version\ngit config --global user.name "Dev Name"\ngit config --global user.email "dev@example.com"\ngit config --list',
        description: 'SECTION A: INITIALIZATION & CONFIGURATION - Kiểm tra phiên bản và thiết lập danh tính Git toàn cục.',
      },
      {
        language: 'bash',
        code: 'git status -s && git log --graph --oneline --decorate --all',
        description: 'SECTION B: REPOSITORY STATUS & TREE - Xem trạng thái làm việc rút gọn và sơ đồ nhánh toàn bộ lịch sử.',
      },
      {
        language: 'bash',
        code: '# Phân biệt git add:\ngit add <file>   # Chỉ stage file chỉ định\ngit add .        # Stage tất cả thay đổi từ thư mục hiện tại trở xuống\ngit add -A       # Stage toàn bộ thay đổi trong toàn bộ Repository (kể cả file đã xóa)\ngit restore --staged <file> # Unstage file về lại Working Directory',
        description: 'SECTION C: STAGING AREA - Đưa thay đổi vào Staging Area và Unstage an toàn.',
      },
      {
        language: 'bash',
        code: 'git commit -m "feat: add user authentication"\ngit commit -am "fix: inline bugfix for tracked files"\ngit commit --amend --no-edit\ngit show HEAD',
        description: 'SECTION D: COMMIT OPERATIONS - Mô hình: Working Directory -> Staging Area -> Commit -> Repository. Amend sửa commit vừa tạo.',
      },
      {
        language: 'bash',
        code: '# Khuyến nghị dùng git switch thay cho checkout:\ngit switch -c feature/payment-gateway  # Tạo & chuyển sang nhánh mới\ngit switch main                         # Chuyển về nhánh main\ngit branch -a                           # Liệt kê tất cả nhánh local & remote\ngit branch -D feature/stale             # 🔴 DESTRUCTIVE: Xóa cứng nhánh chưa merge',
        description: 'SECTION E: BRANCHING - Quản lý nhánh. Ưu tiên git switch thay cho git checkout.',
      },
      {
        language: 'bash',
        code: 'git merge feature/auth            # Fast-forward hoặc 3-way merge\ngit merge --no-ff feature/auth     # Ép tạo Merge Commit để giữ lịch sử nhánh rõ ràng\ngit merge --abort                  # Hủy thao tác merge khi gặp xung đột',
        description: 'SECTION F: MERGING - Tích hợp nhánh. Hỗ trợ Fast-forward và 3-way merge commit.',
      },
      {
        language: 'bash',
        code: '# ⚠ WARNING: Tuyệt đối KHÔNG rebase các commit đã push lên remote shared branch!\ngit rebase main                    # Tái cấu trúc lịch sử tuyến tính mượt mà\ngit rebase -i HEAD~3                # Interactive rebase: squash, reword, edit, drop\ngit rebase --continue              # Tiếp tục sau khi sửa xung đột',
        description: 'SECTION G: REBASE - Tái cấu trúc lịch sử commit tuyến tính. Chú ý cảnh báo bảo mật.',
      },
      {
        language: 'bash',
        code: 'git fetch origin                   # Tải dữ liệu remote về (READ_ONLY, không gộp code)\ngit pull origin main               # fetch + merge\ngit pull --rebase origin main      # fetch + rebase (giữ lịch sử sạch)',
        description: 'SECTION H: REMOTE REPOSITORIES - Phân biệt fetch (download data) và pull (fetch + integrate).',
      },
      {
        language: 'bash',
        code: 'git push -u origin feature/auth    # Push và set upstream tracking\ngit push origin --delete feature/old # Xóa nhánh trên Remote\ngit branch -d feature/merged       # Xóa nhánh local đã merge an toàn',
        description: 'SECTION I: PUSH & REMOTE BRANCH MANAGEMENT - Quản lý push và dọn dẹp nhánh remote.',
      },
      {
        language: 'bash',
        code: 'git log --stat -n 5\ngit diff HEAD~1 HEAD\ngit diff --staged\ngit blame -L 10,25 src/index.ts\ngit reflog',
        description: 'SECTION J: HISTORY INSPECTION & BLAME - Kiểm tra thay đổi, ai sửa dòng code nào và nhật ký thao tác reflog.',
      },
      {
        language: 'bash',
        code: 'git stash push -m "wip: navbar logic"\ngit stash list\ngit stash pop                      # Khôi phục & XÓA stash khỏi danh sách\ngit stash apply                    # Khôi phục nhưng GIỮ stash trong danh sách\ngit stash clear                    # 🔴 DESTRUCTIVE: Xóa sạch toàn bộ stash list',
        description: 'SECTION K: STASHING - Tạm lưu code đang dở dang. Phân biệt stash pop vs apply.',
      },
      {
        language: 'bash',
        code: 'git tag -a v2.4.1 -m "Release v2.4.1 with payment fix"\ngit push origin v2.4.1\ngit push origin --tags',
        description: 'SECTION L: TAGS & SEMANTIC VERSIONING - Đánh nhãn phiên bản theo chuẩn SemVer (MAJOR.MINOR.PATCH).',
      },
      {
        language: 'bash',
        code: '# Phân biệt Restore vs Reset vs Revert:\ngit restore src/app.ts             # Hủy thay đổi chưa staged (READ_ONLY file state)\ngit reset --soft HEAD~1            # Hủy commit, GIỮ code ở Staging Area\ngit reset --mixed HEAD~1           # Hủy commit, GIỮ code ở Working Directory\ngit reset --hard HEAD~1            # 🔴 DESTRUCTIVE: Xóa sạch mọi thay đổi uncommitted!\ngit revert <commit-hash>           # Tạo commit mới đảo ngược thay đổi (An toàn cho shared branch)',
        description: 'SECTION M: UNDO OPERATIONS - Phân loại chi tiết restore, reset (soft/mixed/hard) và revert.',
      },
      {
        language: 'bash',
        code: 'git reflog                          # Tìm lại commit hash đã mất\ngit reset --hard <lost-commit-hash> # Cứu lại commit bị trôi/xóa nhầm\ngit fsck --lost-found               # Kiểm tra dangling commits trong Git database',
        description: 'SECTION N: RECOVERY & DISASTER RECOVERY - Cứu nguy dữ liệu khi xóa nhầm nhánh hoặc reset nhầm.',
      },
      {
        language: 'bash',
        code: 'git cherry-pick <commit-hash>       # Bốc 1 commit cụ thể từ nhánh khác về nhánh hiện tại\ngit cherry-pick --abort             # Hủy bỏ thao tác cherry-pick khi xung đột',
        description: 'SECTION O: CHERRY-PICK - Áp dụng commit cụ thể (vd: hotfix) từ nhánh khác sang nhánh release.',
      },
      {
        language: 'bash',
        code: '# Khi gặp xung đột conflict:\n# 1. git status\n# 2. Sửa các thẻ <<<<<<< HEAD ... ======= ... >>>>>>> feature\n# 3. git add <file>\n# 4. git commit -m "fix: resolve merge conflict"',
        description: 'SECTION P: MERGE CONFLICT RESOLUTION - Quy trình giải quyết xung đột thủ công từng bước.',
      },
    ],
  },
  {
    id: 'git-undo-recovery-masterclass',
    title: 'How to Undo Git Changes & Disaster Recovery Masterclass (Rescue Guide)',
    categoryId: 'git',
    subcategoryId: 'git-undo-recovery',
    tags: ['Git', 'Undo', 'Reflog', 'Reset', 'Revert', 'Recovery', 'Runbook'],
    difficulty: 'Intermediate',
    type: 'runbook',
    readingTimeMinutes: 12,
    summary: 'Hướng dẫn quy trình phục hồi sự cố Git thực chiến: Phân biệt `git restore` vs `git reset` vs `git revert`, cứu lại nhánh/commit đã bị xóa nhầm bằng `git reflog`, và sửa lỗi trót commit file chứa mật khẩu.',
    updatedAt: '2026-08-20',
    prerequisites: [
      'Git Client 2.30+',
      'Hiểu khái niệm Working Tree, Staging Area và Local Commit Repository',
    ],
    snippets: [
      {
        language: 'bash',
        code: `# KỊCH BẢN 1: Trót xóa nhầm nhánh local (git branch -D feature/payment)
git reflog
# Tìm dòng: e4f2a1b HEAD@{3}: commit: feat: complete payment
git checkout -b feature/payment e4f2a1b
# Result: Nhánh bị xóa đã được khôi phục nguyên vẹn!`,
        description: 'Scenario 1: Phục hồi nhánh bị xóa nhầm bằng git reflog.',
      },
      {
        language: 'bash',
        code: `# KỊCH BẢN 2: Trót chạy 'git reset --hard HEAD~1' làm mất commit quan trọng
git reflog
# Tìm commit hash trước khi reset (vd: a1b2c3d)
git reset --hard a1b2c3d
# Result: Commit bị mất đã được kéo lại thành công!`,
        description: 'Scenario 2: Cứu commit bị trôi do lỡ tay gõ git reset --hard.',
      },
      {
        language: 'bash',
        code: `# KỊCH BẢN 3: Đã push commit lỗi lên nhánh main trên Production
# KHÔNG dùng git reset --hard vì sẽ làm hỏng lịch sử của người khác!
git revert <commit-hash-lỗi>
git push origin main
# Result: Tạo commit mới hủy bỏ thay đổi lỗi một cách an toàn và minh bạch.`,
        description: 'Scenario 3: Hủy commit lỗi đã push lên Production an toàn bằng git revert.',
      },
    ],
  },
  {
    id: 'git-merge-rebase-conflict-guide',
    title: 'Git Merge vs Rebase & Conflict Resolution Masterclass',
    categoryId: 'git',
    subcategoryId: 'git-merging',
    tags: ['Git', 'Merge', 'Rebase', 'Conflicts', 'GitFlow', 'Step-by-Step'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    readingTimeMinutes: 11,
    summary: 'So sánh chuyên sâu giữa `git merge` và `git rebase`, cách đọc hiểu thẻ xung đột `<<<<<<< HEAD` và quy trình 6 bước giải quyết Conflict chuẩn Production.',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
                    GIT MERGE vs REBASE ARCHITECTURE
================================================================================
[GIT MERGE Workflow (Preserves Full History)]
main    ── A ────── B ──────── Merge Commit (C+D)
            └─ C ── D (feature) ──┘

[GIT REBASE Workflow (Creates Linear History)]
main    ── A ────── B ── C' ── D' (feature)
            (Commit C,D được re-applied lên đầu nhánh main)`,
    steps: [
      {
        stepNumber: 1,
        title: 'Kiểm Tra Trạng Thái File Xung Đột',
        description: 'Xác định chính xác các file đang ở trạng thái Both Modified khi xảy ra conflict.',
        command: 'git status',
        expectedOutput: 'Hiển thị danh sách Unmerged paths với nhãn both modified.',
      },
      {
        stepNumber: 2,
        title: 'Đọc & Đọc Hiểu Thẻ Xung Đột Trong IDE / Code Editor',
        description: 'Mở file xung đột và phân tích khối code giữa <<<<<<< HEAD (code nhánh hiện tại) và >>>>>>> feature (code nhánh cần gộp).',
        command: 'cat src/services/payment.ts',
        expectedOutput: 'Thấy rõ hai khối code trái ngược nhau chia cắt bởi dấu =======.',
      },
      {
        stepNumber: 3,
        title: 'Thực Hiện Sửa Đổi & Chấp Nhận Code Đúng',
        description: 'Xóa các thẻ marker `<<<<<<<`, `=======`, `>>>>>>>` và giữ lại logic code chính xác.',
        command: 'git add src/services/payment.ts',
        expectedOutput: 'File đã được sửa và đưa vào Staging Area.',
      },
      {
        stepNumber: 4,
        title: 'Hoàn Tất Phiên Merge Hoặc Tiếp Tục Rebase',
        description: 'Tạo commit hoàn tất merge hoặc chạy lệnh rebase --continue.',
        command: 'git commit -m "fix: resolve merge conflict in payment service"\n# Hoặc nếu đang rebase:\ngit rebase --continue',
        expectedOutput: 'Lịch sử nhánh trở lại trạng thái sạch sẽ không còn xung đột.',
      },
    ],
  },
  {
    id: 'git-troubleshooting-masterclass',
    title: 'Tra Cứu & Khắc Phục Top 12 Sự Cố Git Thường Gặp (Git Troubleshooting Masterclass)',
    categoryId: 'git',
    subcategoryId: 'git-troubleshooting',
    tags: ['Git', 'Troubleshooting', 'Debugging', 'Error Fix', 'Detached HEAD', 'Push Rejected'],
    difficulty: 'Intermediate',
    type: 'troubleshoot',
    readingTimeMinutes: 12,
    summary: 'Danh mục tra cứu nguyên nhân và câu lệnh sửa lỗi 12 sự cố Git kinh điển: Push Rejected (Non-Fast-Forward), Merge Conflict, Detached HEAD, Your branch is behind origin, Trót commit mật khẩu và GitHub Authentication Failed.',
    updatedAt: '2026-08-20',
    commonErrors: [
      {
        errorCode: 'error: failed to push some refs to (non-fast-forward / Push Rejected)',
        cause: 'Remote repository chứa các commit mới hơn mà máy local của bạn chưa cập nhật về.',
        solution: 'Chạy `git pull --rebase origin main` để cập nhật code mới nhất về trước khi push lại.',
        commandFix: 'git pull --rebase origin main && git push origin main',
      },
      {
        errorCode: 'You are in "detached HEAD" state',
        cause: 'Bạn vừa checkout trực tiếp vào một Commit hash hoặc Tag thay vì một Nhánh (Branch).',
        solution: 'Tạo một nhánh mới từ vị trí commit hiện tại để giữ lại các thay đổi.',
        commandFix: 'git switch -c temp-fix-branch',
      },
      {
        errorCode: 'Your branch is behind "origin/main" by X commits',
        cause: 'Đồng nghiệp đã merge code mới lên origin/main.',
        solution: 'Kéo code mới về và rebase nhánh feature của bạn lên đầu main.',
        commandFix: 'git switch main && git pull && git switch feature/my-work && git rebase main',
      },
      {
        errorCode: 'fatal: Authentication failed for repository / Permission to user/repo denied',
        cause: 'GitHub Personal Access Token (PAT) hoặc SSH Key đã hết hạn hoặc không có quyền write.',
        solution: 'Tạo mới GitHub Personal Access Token (PAT) với scope `repo` hoặc re-add SSH Key vào ssh-agent.',
        commandFix: 'ssh-add -D && ssh-add ~/.ssh/id_ed25519',
      },
      {
        errorCode: 'fatal: The current branch feature has no upstream branch',
        cause: 'Nhánh local vừa tạo chưa được liên kết tracking với remote repository.',
        solution: 'Push kèm cờ `-u` (set-upstream) để thiết lập liên kết tự động cho các lần push sau.',
        commandFix: 'git push -u origin feature/my-work',
      },
      {
        errorCode: 'fatal: bad revision / Cannot delete branch checked out',
        cause: 'Cố gắng xóa một nhánh trong khi bạn đang đứng chính tại nhánh đó.',
        solution: 'Chuyển sang nhánh `main` trước rồi mới tiến hành xóa nhánh feature.',
        commandFix: 'git switch main && git branch -d feature/my-work',
      },
    ],
  },
  {
    id: 'git-security-ci-devops-workflow',
    title: 'Git Security Essentials, Production Workflows & DevOps CI/CD Integration',
    categoryId: 'git',
    subcategoryId: 'git-security',
    tags: ['Git', 'Security', 'CI/CD', 'GitHub Actions', 'DevOps', 'Docker', 'AWS'],
    difficulty: 'Advanced',
    type: 'concept',
    readingTimeMinutes: 14,
    summary: 'Phân tích quy trình bảo mật Git: Xử lý rò rỉ API Keys/AWS Secrets, quy trình GitFlow vs Trunk-based Production, và mô hình tích hợp đường ống CI/CD tự động (Git -> GitHub Actions -> Docker Build -> AWS EC2). Cung cấp Lộ trình học 10 Cấp độ từ Beginner đến Production Master.',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
               FULL DEVOPS CI/CD INTEGRATION PIPELINE VIA GIT
================================================================================
 Developer ──(git push)──> GitHub Repository ──(Webhook Trigger)──> GitHub Actions
                                                                        │
 ┌──────────────────────────────────────────────────────────────────────┘
 ▼
 [CI STEP 1]: Run Unit Tests & Linter
 ▼
 [CI STEP 2]: Secret Scanning & Security Audit
 ▼
 [CD STEP 3]: Build Multi-Stage Docker Image ──> Push to Container Registry
 ▼
 [CD STEP 4]: Connect AWS EC2 via SSM ──> Run Container Deployment ──> Verified!`,
    prerequisites: [
      'Thành thạo các câu lệnh Git căn bản',
      'Hiểu cơ bản về Docker Containers, AWS EC2 và GitHub Actions Workflows',
    ],
    learningPath: [
      'Level 1: Git Fundamentals & Installation',
      'Level 2: Daily Git Workflow (add, commit, push, pull)',
      'Level 3: Branching & Merge Strategies',
      'Level 4: Rebase & History Cleanup',
      'Level 5: Advanced Conflict Resolution',
      'Level 6: Git Reflog & Disaster Recovery',
      'Level 7: Git Security & Secret Leak Prevention',
      'Level 8: Team Collaboration & Code Reviews',
      'Level 9: CI/CD Pipeline Integration (GitHub Actions)',
      'Level 10: Production Trunk-Based & GitFlow Workflows',
    ],
  },
  {
    id: 'docker-cli-cheatsheet',
    title: 'Docker CLI Command Cheatsheet (Daily Operations & Production Essentials)',
    categoryId: 'docker',
    subcategoryId: 'docker-fundamentals',
    isBookmarked: true,
    tags: ['Docker', 'CLI', 'DevOps', 'Cheatsheet', 'Containers', 'Images'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    readingTimeMinutes: 7,
    summary: 'Tra cứu nhanh toàn bộ câu lệnh Docker CLI hàng ngày: Quản lý Image, Vòng đời Container, Kiểm tra Log & Debug, Quản lý Volume & Network, và Dọn dẹp bộ nhớ (System Prune).',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'bash',
        code: 'docker --version && docker info && docker system df',
        description: 'Kiểm tra phiên bản Docker CLI/Engine, tổng quan bộ nhớ Disk/RAM và số lượng Container/Image/Volume đang chiếm dụng.',
      },
      {
        language: 'bash',
        code: 'docker build -t my-app:v1.0.0 -f Dockerfile .',
        description: 'Build Docker Image từ Dockerfile hiện tại với Tag phiên bản cụ thể.',
      },
      {
        language: 'bash',
        code: 'docker run -d --name web-app -p 8080:80 --restart unless-stopped -v app-data:/app/data my-app:v1.0.0',
        description: 'Khởi chạy Container ngầm (-d), map Port 8080 host vào Port 80 container, gán Volume và tự động khởi động lại khi crash.',
      },
      {
        language: 'bash',
        code: 'docker exec -it web-app sh\n# Hoặc mở Bash shell:\ndocker exec -it web-app /bin/bash',
        description: 'Truy cập trực tiếp phiên làm việc tương tác Terminal bên trong Container đang chạy.',
      },
      {
        language: 'bash',
        code: 'docker logs -f --tail 100 web-app',
        description: 'Theo dõi Real-time Log (Follow mode) 100 dòng mới nhất của Container.',
      },
      {
        language: 'bash',
        code: 'docker stats --no-stream && docker top web-app',
        description: 'Giám sát tài nguyên CPU, RAM, Network I/O và xem danh sách tiến trình (Processes) đang chạy trong Container.',
      },
      {
        language: 'bash',
        code: 'docker volume ls && docker network ls',
        description: 'Liệt kê tất cả các Persistent Volumes và Virtual Networks hiện có trên Docker Host.',
      },
      {
        language: 'bash',
        code: 'docker system prune -a --volumes -f',
        description: 'Dọn dẹp triệt để tất cả Stopped Containers, Unused Networks, Dangling Images và Orphan Volumes để giải phóng ổ đĩa.',
      },
    ],
  },
  {
    id: 'docker-container-setup',
    title: 'Quy Trình Multi-Stage Build & Container Hóa Ứng Dụng Chuẩn Production',
    categoryId: 'docker',
    subcategoryId: 'dockerfile',
    tags: ['Docker', 'Dockerfile', 'Multi-Stage', 'Node.js', 'Security', 'Optimization'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    readingTimeMinutes: 10,
    summary: 'Hướng dẫn chi tiết từng bước xây dựng Dockerfile tối ưu kích thước Image (giảm từ 1GB xuống dưới 80MB) bằng kỹ thuật Multi-Stage Build, chạy non-root user an toàn và thiết lập .dockerignore chuẩn.',
    updatedAt: '2026-08-20',
    prerequisites: [
      'Cài đặt Docker Engine 24.0+ hoặc Docker Desktop',
      'Hiểu cấu trúc dự án Node.js / React / Go',
      'Quyền chạy lệnh Terminal / PowerShell',
    ],
    steps: [
      {
        stepNumber: 1,
        title: 'Tạo File .dockerignore Ngăn Nạp Thư Mục Rác',
        description: 'Loại bỏ node_modules, build artifacts, file môi trường .env và git logs khỏi Docker build context để tăng tốc độ build.',
        command: 'cat << "EOF" > .dockerignore\nnode_modules\n.git\n.env\ndist\ncoverage\n*.log\nEOF',
        expectedOutput: 'File .dockerignore được khởi tạo thành công.',
        tips: 'Tránh copy node_modules từ local machine vào container để tránh lệch OS binaries.',
      },
      {
        stepNumber: 2,
        title: 'Viết Multi-Stage Dockerfile Chuẩn An Toàn & Tối Ưu',
        description: 'Tách giai đoạn Build (chứa SDK compiler nặng) và giai đoạn Runtime (chỉ chứa file JS đã biên dịch trên nền Alpine Linux siêu nhẹ). Gán non-root user nodejs để chặn tấn công Privilege Escalation.',
        command: `cat << "EOF" > Dockerfile
# Stage 1: Build Dependencies & Compile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production Runtime Only
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force
COPY --from=builder /app/dist ./dist
USER nodejs
EXPOSE 3000
CMD ["node", "dist/index.js"]
EOF`,
        expectedOutput: 'File Dockerfile Multi-stage chuẩn production được khởi tạo.',
      },
      {
        stepNumber: 3,
        title: 'Build & Kiểm Tra Kích Thước Docker Image',
        description: 'Thực thi lệnh docker build và so sánh kích thước Image sau khi áp dụng Multi-stage.',
        command: 'docker build -t dcc-backend-app:v1.0.0 .\ndocker images dcc-backend-app:v1.0.0',
        expectedOutput: 'DCC Image được khởi tạo với kích thước siêu nhỏ (< 100MB).',
      },
      {
        stepNumber: 4,
        title: 'Khởi Chạy & Kiểm Tra Quyền Hạn Non-Root User',
        description: 'Chạy Container và xác nhận tiến trình không chạy dưới quyền root.',
        command: 'docker run -d --name dcc-backend -p 3000:3000 dcc-backend-app:v1.0.0\ndocker exec dcc-backend whoami',
        expectedOutput: 'Lệnh whoami trả về nodejs (Non-root user).',
      },
    ],
  },
  {
    id: 'docker-compose-production-guide',
    title: 'Docker Compose Orchestration Cho Hệ Thống Multi-Container (App + Postgres + Redis + Nginx)',
    categoryId: 'docker',
    subcategoryId: 'docker-compose',
    tags: ['Docker', 'Docker Compose', 'PostgreSQL', 'Redis', 'Nginx', 'Runbook'],
    difficulty: 'Intermediate',
    type: 'runbook',
    readingTimeMinutes: 12,
    summary: 'Quy trình khởi chạy và vận hành hệ thống đa dịch vụ bằng Docker Compose: Cấu hình Healthcheck, khởi động theo phụ thuộc (depends_on condition: service_healthy), phân tách môi trường .env và cấu hình Reverse Proxy Nginx.',
    updatedAt: '2026-08-20',
    prerequisites: [
      'Docker Compose v2.20+',
      'Dịch vụ App Backend, Postgres Database, Redis Cache và Nginx Server',
    ],
    snippets: [
      {
        language: 'yaml',
        code: `version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: dcc-app-backend
    restart: always
    environment:
      - NODE_ENV=production
      - DB_HOST=postgres-db
      - DB_PORT=5432
      - REDIS_HOST=redis-cache
    depends_on:
      postgres-db:
        condition: service_healthy
      redis-cache:
        condition: service_healthy
    networks:
      - dcc-internal-net

  postgres-db:
    image: postgres:15-alpine
    container_name: dcc-postgres-db
    restart: always
    environment:
      POSTGRES_USER: \${DB_USER:-dccuser}
      POSTGRES_PASSWORD: \${DB_PASS:-dccsecret}
      POSTGRES_DB: \${DB_NAME:-dccdb}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER:-dccuser}"]
      interval: 5s
      timeout: 5s
      retries: 5
    networks:
      - dcc-internal-net

  redis-cache:
    image: redis:7-alpine
    container_name: dcc-redis-cache
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    networks:
      - dcc-internal-net

  nginx:
    image: nginx:alpine
    container_name: dcc-nginx-proxy
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - app
    networks:
      - dcc-internal-net

volumes:
  postgres-data:
    driver: local

networks:
  dcc-internal-net:
    driver: bridge`,
        description: 'File docker-compose.yml hoàn chỉnh cho môi trường Production với Healthcheck & Persistent Volume.',
      },
    ],
  },
  {
    id: 'docker-troubleshoot-guide',
    title: 'Tra Cứu & Khắc Phục Top 5 Sự Cố Docker Thường Gặp (Debugging Masterclass)',
    categoryId: 'docker',
    subcategoryId: 'docker-debugging',
    tags: ['Docker', 'Troubleshooting', 'Debugging', 'Error Fix', 'OOMKilled', 'EADDRINUSE'],
    difficulty: 'Intermediate',
    type: 'troubleshoot',
    readingTimeMinutes: 9,
    summary: 'Danh mục tra cứu nguyên nhân và câu lệnh sửa lỗi sự cố Container: Container vừa bật đã tự tắt (Exit code 0/137 OOMKilled), xung đột Port EADDRINUSE, tràn bộ nhớ Docker daemon và lỗi DNS container không gọi được API host.',
    updatedAt: '2026-08-20',
    commonErrors: [
      {
        errorCode: 'Container Exited with Code 137 (OOMKilled)',
        cause: 'Container vượt quá giới hạn bộ nhớ RAM cho phép (Out Of Memory) và bị Linux Kernel OOM Killer tiêu diệt.',
        solution: 'Tăng giới hạn `--memory` trong docker run / docker-compose.yml hoặc kiểm tra memory leak trong mã nguồn ứng dụng.',
        commandFix: 'docker inspect web-app --format="{{.State.OOMKilled}} {{.State.ExitCode}}"',
      },
      {
        errorCode: 'Error starting userland proxy: listen tcp4 0.0.0.0:8080: bind: address already in use',
        cause: 'Port 8080 trên Docker Host đã bị chiếm dụng bởi tiến trình local khác hoặc một Container khác.',
        solution: 'Tìm PID của tiến trình đang chiếm Port bằng netstat / lsof và kill tiến trình đó, hoặc đổi Port host map (vd: -p 8081:8080).',
        commandFix: 'sudo netstat -tulpn | grep 8080\n# Hoặc tiêu diệt tiến trình chiếm port:\nsudo kill -9 <PID>',
      },
      {
        errorCode: 'No space left on device (Docker Storage Driver Full)',
        cause: 'Ổ đĩa Docker Host bị đầy do chứa quá nhiều Dangling Images, Unused Containers, Build Cache và Log files khổng lồ.',
        solution: 'Thực thi dọn dẹp hệ thống Docker và thiết lập giới hạn Log rotation trong `/etc/docker/daemon.json`.',
        commandFix: 'docker system prune -a --volumes -f && docker builder prune -a -f',
      },
      {
        errorCode: 'Container Cannot Resolve host.docker.internal / Localhost Connection Refused',
        cause: 'Ứng dụng trong Container cố gắng gọi API service chạy ở Localhost máy mẹ qua 127.0.0.1 (trong container, 127.0.0.1 trỏ vào chính nó).',
        solution: 'Sử dụng DNS host đặc biệt `host.docker.internal` hoặc thêm `--add-host=host.docker.internal:host-gateway` khi run container.',
        commandFix: 'docker run -d --add-host=host.docker.internal:host-gateway my-app',
      },
      {
        errorCode: 'Permission Denied: /var/run/docker.sock',
        cause: 'User Linux hiện tại chưa được cấp quyền truy cập vào UNIX socket của Docker daemon.',
        solution: 'Thêm User hiện tại vào group `docker` và khởi động lại phiên SSH/Terminal.',
        commandFix: 'sudo usermod -aG docker $USER && newgrp docker',
      },
    ],
  },
  {
    id: 'docker-networking-volume-deepdive',
    title: 'Kiến Trúc Mạng Docker Networking & Lưu Trữ Dữ Liệu Volume Deep Dive',
    categoryId: 'docker',
    subcategoryId: 'docker-networking',
    tags: ['Docker', 'Networking', 'Volumes', 'Architecture', 'Bridge', 'DNS'],
    difficulty: 'Advanced',
    type: 'concept',
    readingTimeMinutes: 11,
    summary: 'Phân tích chuyên sâu về mô hình Mạng Docker (Bridge, Host, Overlay networks), cơ chế Embedded DNS resolution giữa các Container theo tên service, và so sánh 3 phương thức lưu dữ liệu: Named Volumes, Bind Mounts và Tmpfs.',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
                    DOCKER NETWORKING & STORAGE ARCHITECTURE
================================================================================
                     [ DOCKER HOST ENGINE ]
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
 [ BRIDGE NETWORK ]     [ HOST NETWORK ]      [ DOCKER VOLUMES ]
  Custom subnet          Shared network IP     /var/lib/docker/volumes/
  Embedded DNS (127.0.0.11) Direct host port   Persists across restarts
       │                       │                       │
       ▼                       ▼                       ▼
  ┌──────────┐            ┌──────────┐            ┌──────────┐
  │ App Cont │            │ Nginx    │            │ Postgres │
  │ 172.18.0.2│            │ 127.0.0.1│            │ Data Vol │
  └────┬─────┘            └──────────┘            └──────────┘
       │ (DNS: ping postgres-db)
       ▼
  ┌──────────┐
  │ DB Cont  │
  │ 172.18.0.3│
  └──────────┘`,
    prerequisites: [
      'Hiểu cơ bản về TCP/IP Networking và Linux Mount points',
    ],
  },
  {
    id: 'react-vite-performance',
    title: 'Tối Ưu Hóa Tốc Độ Build & Code Splitting Trong React + Vite',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react',
    tags: ['React', 'Vite', 'Performance'],
    difficulty: 'Advanced',
    type: 'cheatsheet',
    summary: 'Các kỹ thuật chia nhỏ Bundle (Code-Splitting), nạp lười Component (React.lazy) và tối ưu Rollup Chunks trong Vite.',
    updatedAt: '2026-08-10',
    readingTimeMinutes: 6,
    snippets: [
      {
        language: 'typescript',
        code: `import React, { Suspense, lazy } from 'react';

// Dynamic Import cho các trang nặng
const LargeChartModule = lazy(() => import('./components/LargeChart'));

export function Dashboard() {
  return (
    <div>
      <Suspense fallback={<div className="p-4">Đang tải biểu đồ...</div>}>
        <LargeChartModule />
      </Suspense>
    </div>
  );
}`,
        description: 'Tải Component theo yêu cầu để giảm dung lượng file JavaScript ban đầu.',
      },
    ],
  },
  {
    id: 'troubleshoot-port-conflict',
    title: 'Tra Cứu & Xử Lý Lỗi Xung Đột Port (EADDRINUSE)',
    categoryId: 'troubleshooting',
    tags: ['CLI', 'Port', 'Debugging', 'Troubleshooting'],
    difficulty: 'Beginner',
    type: 'troubleshoot',
    summary: 'Danh mục tra cứu mã lỗi port bị chiếm dụng trên Windows và macOS/Linux kèm lệnh tiêu diệt tiến trình chiếm port.',
    updatedAt: '2026-08-19',
    readingTimeMinutes: 4,
    commonErrors: [
      {
        errorCode: 'EADDRINUSE: port 3000 already in use',
        cause: 'Một ứng dụng khác (Node.js, Python, Server cũ) đang chạy ngầm trên cổng 3000.',
        solution: 'Tìm PID của tiến trình chiếm cổng 3000 và tiến hành Force Kill.',
        commandFix: 'netstat -ano | findstr :3000',
      },
      {
        errorCode: 'ERR_CONNECTION_REFUSED',
        cause: 'Server backend chưa được khởi chạy hoặc bị chặn bởi Firewall/Antivirus.',
        solution: 'Kiểm tra lại xem service backend đã khởi chạy chưa bằng lệnh Task Manager hoặc DCC Processes tab.',
        commandFix: 'curl http://localhost:3000/health',
      },
      {
        errorCode: 'Permission Denied (publickey)',
        cause: 'SSH Key chưa được add vào SSH Agent hoặc tài khoản GitHub/GitLab chưa cấp quyền.',
        solution: 'Khởi động SSH Agent và nạp file RSA/Ed25519 key.',
        commandFix: 'eval "$(ssh-agent -s)" && ssh-add ~/.ssh/id_ed25519',
      },
    ],
  },
  {
    id: 'tauri-rust-cli-setup',
    title: 'Hướng Dẫn Build App Desktop Bằng Tauri v2 & Rust',
    categoryId: 'cli',
    tags: ['Tauri', 'Rust', 'Desktop'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    summary: 'Từng bước kiểm tra môi trường Rust, cấu hình Cargo, và đóng gói ứng dụng Tauri 2.0 ra installer siêu nhẹ.',
    updatedAt: '2026-08-17',
    readingTimeMinutes: 7,
    steps: [
      {
        stepNumber: 1,
        title: 'Kiểm tra phiên bản Rust Toolchain',
        description: 'Đảm bảo rustc và cargo đã đạt phiên bản tối thiểu hỗ trợ Tauri 2.0.',
        command: 'rustc --version && cargo --version',
        expectedOutput: 'rustc 1.75.0 (hoặc cao hơn)',
      },
      {
        stepNumber: 2,
        title: 'Chạy ứng dụng thử nghiệm ở môi trường Dev',
        description: 'Khởi chạy đồng thời Frontend Vite và Rust Backend với khả năng Hot-Reload.',
        command: 'npm run tauri dev',
        expectedOutput: 'Cửa sổ ứng dụng Desktop hiển thị thành công.',
      },
      {
        stepNumber: 3,
        title: 'Đóng gói Installer Production',
        description: 'Tạo file cài đặt EXE / MSI cho Windows hoặc DMGs cho macOS.',
        command: 'npm run tauri build',
        expectedOutput: 'File cài đặt nằm trong src-tauri/target/release/bundle/.',
      },
    ],
  },
  {
    id: 'react-vite-setup-guide',
    title: 'Create a React + Vite Project from Scratch & Project Architecture Guide',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-fundamentals',
    tags: ['React', 'Vite', 'TypeScript', 'Setup', 'Architecture', 'Frontend'],
    difficulty: 'Beginner',
    type: 'step_by_step',
    readingTimeMinutes: 8,
    summary: 'Quy trình khởi tạo dự án React + TypeScript từ con số 0 với Vite: Khởi tạo project, cài đặt dependencies, chạy Dev Server với HMR, build bundle Production và phân tích cấu trúc thư mục tiêu chuẩn.',
    updatedAt: '2026-08-20',
    prerequisites: [
      'Node.js v18.0.0 hoặc mới hơn (khuyên dùng Node 20 LTS)',
      'Trình quản lý gói npm v9.0.0+ hoặc pnpm/yarn',
      'VS Code Editor kèm TypeScript + ESLint Extensions',
      'Git Client để quản lý mã nguồn',
    ],
    architectureDiagram: `================================================================================
                    REACT + VITE PROJECT ARCHITECTURE
================================================================================
my-react-app/
├── node_modules/             # Dependency packages
├── public/                   # Static raw assets (favicon, robots.txt)
├── src/                      # Application Source Code
│   ├── assets/               # Scalable assets (SVGs, Images, Global CSS)
│   ├── components/           # Reusable UI components (Button, Modal, Card)
│   ├── pages/                # Page-level components & Route views
│   ├── hooks/                # Custom React Hooks (useAuth, useFetch)
│   ├── services/             # API client & External Service connectors
│   ├── App.tsx               # Root Component & Layout shell
│   ├── main.tsx              # Application Entrypoint (ReactDOM.createRoot)
│   └── vite-env.d.ts         # Vite TypeScript type declarations
├── .env                      # Environment Variables
├── index.html                # Entry HTML document (holds <div id="root">)
├── package.json              # Project manifests & script aliases
├── tsconfig.json             # TypeScript compiler settings
└── vite.config.ts            # Vite Dev Server & Bundler configuration`,
    steps: [
      {
        stepNumber: 1,
        title: 'Khởi Tạo Project React + TypeScript Bằng Vite CLI',
        description: 'Sử dụng lệnh create-vite để tạo cấu trúc dự án React với TypeScript Template chuẩn hóa.',
        command: 'npm create vite@latest my-react-app -- --template react-ts',
        expectedOutput: 'Scaffolding project in my-react-app... Done.',
        tips: 'Sử dụng cờ --template react-ts để chuẩn hóa sẵn TypeScript.',
      },
      {
        stepNumber: 2,
        title: 'Truy Cập Thư Mục & Cài Đặt Dependencies',
        description: 'Di chuyển vào thư mục vừa tạo và tiến hành cài đặt các gói phụ thuộc.',
        command: 'cd my-react-app && npm install',
        expectedOutput: 'added XXX packages, and audited packages in X seconds.',
      },
      {
        stepNumber: 3,
        title: 'Khởi Chạy Vite Development Server',
        description: 'Bật máy chủ phát triển siêu tốc với tính năng Hot Module Replacement (HMR).',
        command: 'npm run dev',
        expectedOutput: 'VITE v5.x.x ready in XXX ms. Local: http://localhost:5173/',
        tips: 'Mở trình duyệt tại http://localhost:5173 để theo dõi ứng dụng.',
      },
      {
        stepNumber: 4,
        title: 'Biên Dịch Bundle Sản Phẩm (Production Build)',
        description: 'Biên dịch TypeScript và nén tối ưu toàn bộ code/assets ra thư mục dist/.',
        command: 'npm run build',
        expectedOutput: 'vite build complete in X.XXs. Output written to dist/.',
      },
      {
        stepNumber: 5,
        title: 'Xem Trước Bản Build Production Trên Local Host',
        description: 'Khởi chạy HTTP Server nhẹ để kiểm tra bản dist/ trước khi deploy lên Nginx/Vercel.',
        command: 'npm run preview',
        expectedOutput: 'Local preview server running at http://localhost:4173/',
      },
    ],
  },
  {
    id: 'vite-cli-cheatsheet',
    title: 'Vite CLI Command Cheatsheet & Package Management',
    categoryId: 'frontend',
    subcategoryId: 'frontend-vite-cli',
    isBookmarked: true,
    tags: ['Vite', 'CLI', 'React', 'npm', 'Cheatsheet', 'DevOps'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    readingTimeMinutes: 7,
    summary: 'Tra cứu nhanh toàn bộ câu lệnh Vite CLI & npm package management: Khởi tạo, Dev server, Production build, Preview, cài đặt/gỡ bỏ dependencies và sơ đồ luồng thực thi câu lệnh.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'bash',
        code: '# COMMAND 1: npm create vite@latest\n# PURPOSE: Khởi tạo dự án mới từ các template có sẵn (React, Vue, Svelte)\n# EXAMPLE:\nnpm create vite@latest my-app -- --template react-ts\n# EXPECTED: Thư mục my-app được tạo với đầy đủ file cấu hình sẵn.\n# COMMON PROBLEMS: Node.js phiên bản quá cũ (< 18.0) hoặc không có quyền ghi thư mục.',
        description: 'npm create vite@latest - Khởi tạo dự án React/Vite mới.',
      },
      {
        language: 'bash',
        code: '# COMMAND 2: npm install\n# PURPOSE: Đọc file package.json và tải tất cả thư viện cần thiết vào node_modules/\n# EXAMPLE:\nnpm install\n# EXPECTED: Thư mục node_modules/ và package-lock.json được khởi tạo/cập nhật.\n# COMMON PROBLEMS: Lỗi mạng Registry, xung đột phiên bản peer-dependencies.',
        description: 'npm install - Tải và cài đặt các phụ thuộc dự án.',
      },
      {
        language: 'bash',
        code: '# COMMAND 3: npm run dev\n# PURPOSE: Khởi chạy Vite Dev Server tại cổng 5173 với Hot Module Replacement (HMR)\n# EXAMPLE:\nnpm run dev\n# EXPECTED: Dev server chạy tại http://localhost:5173.\n# COMMON PROBLEMS: Port 5173 already in use (xung đột cổng) hoặc thiếu node_modules.',
        description: 'npm run dev - Chạy môi trường phát triển Hot-Reload.',
      },
      {
        language: 'bash',
        code: '# COMMAND 4: npm run build\n# PURPOSE: Biên dịch TSX/JSX, nén CSS/JS và đóng gói thành file tĩnh trong dist/\n# EXAMPLE:\nnpm run build\n# EXPECTED: Tạo thư mục dist/ chứa index.html và assets/ đã được minify.\n# COMMON PROBLEMS: Lỗi TypeScript typecheck (tsc), import path không tồn tại.',
        description: 'npm run build - Biên dịch bundle sẵn sàng cho Production.',
      },
      {
        language: 'bash',
        code: '# COMMAND 5: npm run preview\n# PURPOSE: Khởi chạy HTTP local server giả lập môi trường Production để test thư mục dist/\n# EXAMPLE:\nnpm run preview\n# EXPECTED: Server chạy tại http://localhost:4173.\n# COMMON PROBLEMS: Chưa chạy npm run build trước đó khiến thư mục dist/ không tồn tại.',
        description: 'npm run preview - Xem trước sản phẩm sau khi build.',
      },
      {
        language: 'bash',
        code: '# COMMAND 6: Quản lý Packages (npm install / uninstall)\n# Quản lý runtime dependencies:\nnpm install lucide-react axios\n# Quản lý development dependencies (-D):\nnpm install -D tailwindcss postcss autoprefixer\n# Gỡ bỏ package:\nnpm uninstall lodash',
        description: 'Cài đặt & Gỡ bỏ packages (Runtime vs DevDependencies).',
      },
    ],
  },
  {
    id: 'react-state-hooks-masterclass',
    title: 'React State Management, Immutability & Hooks Masterclass',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    tags: ['React', 'State', 'Hooks', 'useState', 'useEffect', 'useMemo', 'Immutability'],
    difficulty: 'Intermediate',
    type: 'concept',
    readingTimeMinutes: 12,
    summary: 'Phân tích chuyên sâu tư duy quản lý State trong React: Vòng đời State -> Render -> Re-render, nguyên tắc Bất biến (Immutability) với Object & Array, và hướng dẫn sử dụng 7 React Hooks cốt lõi chuẩn Production.',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
                    REACT STATE MENTAL MODEL & IMMUTABILITY
================================================================================
   User Action (Click/Input)
              │
              ▼
   setState(newValue / prev => newValue)
              │
              ▼
   React Schedules Re-render
              │
              ▼
   Execute Component Function (Compute new Virtual DOM)
              │
              ▼
   React Reconciliation (Diffing algorithm)
              │
              ▼
   Update Real DOM (Only changed elements)

--------------------------------------------------------------------------------
🔴 MUTATION ANTI-PATTERN (DO NOT DO THIS!):
   user.name = "Hieu";          // React WILL NOT detect change! No re-render!
   items.push(newItem);         // Direct array mutation breaks shallow comparison!

🟢 IMMUTABLE STATE UPDATES (ALWAYS DO THIS!):
   setUser(prev => ({ ...prev, name: "Hieu" }));
   setItems(prev => [...prev, newItem]);
   setItems(prev => prev.filter(item => item.id !== targetId));`,
    prerequisites: [
      'Hiểu cú pháp JavaScript ES6+ (Spread operator, Arrow functions, Destructuring)',
      'Hiểu khái niệm Functional Component trong React',
    ],
  },
  {
    id: 'react-events-rendering-router-guide',
    title: 'React Events, Forms, Rendering Engine & React Router Guide',
    categoryId: 'frontend',
    subcategoryId: 'frontend-events-forms',
    tags: ['React', 'Events', 'Forms', 'Rendering', 'React Router', 'Runbook'],
    difficulty: 'Intermediate',
    type: 'runbook',
    readingTimeMinutes: 11,
    summary: 'Quy trình xử lý Sự kiện & Biểu mẫu (Controlled Components), cơ chế Rendering Virtual DOM & Key Prop stability, và kỹ thuật định tuyến Client-side với React Router (Params, Navigation, Protected Routes).',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { useState, FormEvent } from 'react';

export function UserForm() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault(); // Ngăn trình duyệt reload trang
    console.log('Submitting form:', { email, role });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email..."
      />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="developer">Developer</option>
        <option value="lead">Tech Lead</option>
      </select>
      <button type="submit">Submit</button>
    </form>
  );
}`,
        description: 'Controlled Component & Form submission với e.preventDefault().',
      },
      {
        language: 'tsx',
        code: `import { Routes, Route, useNavigate, useParams } from 'react-router-dom';

function UserDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  return (
    <div>
      <h2>User ID: {id}</h2>
      <button onClick={() => navigate('/users')}>Back to Users</button>
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/users" element={<UserList />} />
      <Route path="/users/:id" element={<UserDetail />} />
    </Routes>
  );
}`,
        description: 'Cấu hình React Router v6 với useParams và useNavigate.',
      },
    ],
  },
  {
    id: 'vite-config-env-proxy-guide',
    title: 'Vite Configuration, Environment Variables & Dev Proxy Masterclass',
    categoryId: 'frontend',
    subcategoryId: 'frontend-vite-config',
    tags: ['Vite', 'Config', 'Env', 'Proxy', 'CORS', 'Security'],
    difficulty: 'Intermediate',
    type: 'runbook',
    readingTimeMinutes: 10,
    summary: 'Cấu hình chuyên sâu `vite.config.ts`: Đổi Port/Host, thiết lập Alias `@/`, quản lý biến môi trường `.env` an toàn với tiền tố `VITE_` và cấu hình Development Proxy giải quyết triệt để lỗi CORS.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'typescript',
        code: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    host: true, // Cho phép truy cập từ LAN / Docker host
    proxy: {
      '/api': {
        target: 'http://localhost:8080', // Chuyển tiếp request API sang backend
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Tắt sourcemap ở Production để bảo mật code
  },
});`,
        description: 'File vite.config.ts chuẩn production với Alias @/ và Development Proxy.',
      },
      {
        language: 'bash',
        code: `# 🔴 SECURITY WARNING:
# Tất cả biến môi trường có tiền tố VITE_ sẽ được biên dịch TRỰC TIẾP vào file bundle JS công khai!
# Tuyệt đối KHÔNG đặt Mật khẩu, Private Key, Database Passwords vào file .env!

# File .env
VITE_API_URL=http://localhost:8080/api
VITE_APP_TITLE=Developer Control Center

# Đọc biến môi trường trong code React:
const apiUrl = import.meta.env.VITE_API_URL;`,
        description: 'Quản lý biến môi trường .env và cảnh báo bảo mật VITE_ prefix.',
      },
    ],
  },
  {
    id: 'react-vite-troubleshooting-production',
    title: 'Top 10 React & Vite Debugging Masterclass & Production Checklist',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-debugging',
    tags: ['React', 'Vite', 'Troubleshooting', 'Debugging', 'Production', 'Checklist'],
    difficulty: 'Intermediate',
    type: 'troubleshoot',
    readingTimeMinutes: 12,
    summary: 'Danh mục tra cứu nguyên nhân & cách khắc phục 10 lỗi React/Vite thường gặp (Invalid Hook Call, Too Many Re-renders, Missing Key Prop, Import Path Unresolved) và Checklist 14 bước chuẩn bị trước khi Deploy.',
    updatedAt: '2026-08-20',
    commonErrors: [
      {
        errorCode: 'Error: Invalid hook call. Hooks can only be called inside of the body of a function component.',
        cause: 'Gọi Hook bên ngoài Component (vd: trong helper function), gọi Hook bên trong vòng lặp `for` / câu điều kiện `if`, hoặc trùng lặp phiên bản React.',
        solution: 'Chuyển vị trí gọi Hook lên mức cao nhất (top-level) của Functional Component.',
        commandFix: 'npm ls react',
      },
      {
        errorCode: 'Uncaught Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.',
        cause: 'Truyền trực tiếp lời gọi hàm vào prop sự kiện thay vì truyền arrow function (vd: `onClick={setCount(count + 1)}`).',
        solution: 'Đổi thành Arrow Function `onClick={() => setCount(count + 1)}`.',
        commandFix: '// Code sai: onClick={handleClick()}\n// Code đúng: onClick={handleClick}',
      },
      {
        errorCode: 'Warning: Each child in a list should have a unique "key" prop.',
        cause: 'Map danh sách JSX mà không truyền thuộc tính `key` duy nhất cho phần tử ngoài cùng.',
        solution: 'Bổ sung `key={item.id}` sử dụng ID định danh ổn định (tránh dùng array index nếu danh sách có sắp xếp/xóa).',
        commandFix: '{items.map(item => <Item key={item.id} data={item} />)}',
      },
      {
        errorCode: 'Failed to resolve import "../../../assets/logo.png" from "src/components/Header.tsx". Does the file exist?',
        cause: 'Đường dẫn tương đối bị sai tầng thư mục hoặc sai ký tự hoa/thường (case-sensitive OS).',
        solution: 'Sử dụng Path Alias `@/assets/logo.png` đã được cấu hình trong `vite.config.ts`.',
        commandFix: 'import logo from "@/assets/logo.png";',
      },
      {
        errorCode: 'Access to fetch at "http://localhost:8080/api" from origin "http://localhost:5173" has been blocked by CORS policy.',
        cause: 'Trình duyệt chặn request cross-origin giữa Dev Server (port 5173) và Backend (port 8080).',
        solution: 'Cấu hình Development Proxy trong `vite.config.ts` hoặc bật CORS header ở Backend.',
        commandFix: '// Cấu hình proxy trong vite.config.ts: server.proxy["/api"]',
      },
    ],
  },
  {
    id: 'react-hooks-fundamentals',
    title: 'React Hooks Fundamentals — Rules, Mental Model & When to Use Hooks',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    tags: ['React', 'Hooks', 'Fundamentals', 'RulesOfHooks', 'Architecture'],
    difficulty: 'Beginner',
    type: 'concept',
    readingTimeMinutes: 9,
    summary: 'Tổng quan nền tảng về React Hooks: Khái niệm, lý do React chuyển từ Class sang Functional Components, tư duy vòng đời Hook, 2 Quy tắc vàng (Rules of Hooks), cấu hình eslint-plugin-react-hooks và khi nào tạo Custom Hook.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `// 🟢 ĐÚNG: Gọi Hook ở top-level của Functional Component
export function UserProfile({ userId }: { userId: string }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId).then(data => {
      setUser(data);
      setLoading(false);
    });
  }, [userId]);

  return <div>{loading ? 'Loading...' : user?.name}</div>;
}

// 🔴 SAI: Gọi Hook bên trong câu điều kiện (if) hoặc vòng lặp (for)
function BadComponent({ isLoaded }: { isLoaded: boolean }) {
  if (isLoaded) {
    useEffect(() => {}); // ❌ VI PHẠM RULES OF HOOKS! Gọi hook có điều kiện làm lệch thứ tự Hook Array!
  }
}`,
        description: 'Phân biệt gọi Hook đúng quy tắc Top-Level và lỗi gọi Hook có điều kiện.',
      },
    ],
  },
  {
    id: 'react-hook-usestate-masterclass',
    title: 'useState — State Management từ Cơ Bản đến Thực Chiến',
    categoryId: 'frontend',
    subcategoryId: 'frontend-props-state',
    tags: ['React', 'useState', 'State', 'Immutability', 'Step-by-Step'],
    difficulty: 'Beginner',
    type: 'step_by_step',
    readingTimeMinutes: 10,
    summary: 'Hướng dẫn toàn diện về useState: Quản lý Primitive, Object & Array state, kỹ thuật Functional Update (`prev => prev + 1`), State Batching, Lazy Initial State và nguyên tắc Bất biến (Immutability).',
    updatedAt: '2026-08-20',
    steps: [
      {
        stepNumber: 1,
        title: 'Khởi Tạo Primitive State & Khái Niệm Re-render',
        description: 'Khai báo biến state đơn giản và gọi hàm updater để yêu cầu React re-render giao diện.',
        command: 'const [count, setCount] = useState(0);',
        expectedOutput: 'Biến count được khởi tạo giá trị 0.',
      },
      {
        stepNumber: 2,
        title: 'Sử Dụng Functional State Update Tránh Stale State',
        description: 'Khi việc cập nhật dựa trên giá trị state trước đó, luôn truyền vào một arrow function nhận tham số prev.',
        command: 'setCount(prev => prev + 1);',
        expectedOutput: 'Giá trị count được tăng chính xác ngay cả khi gọi liên tiếp trong 1 event.',
      },
      {
        stepNumber: 3,
        title: 'Cập Nhật State Object Chuẩn Bất Biến (Immutability)',
        description: 'Sử dụng Spread operator (...) để giữ nguyên các thuộc tính cũ khi cập nhật thuộc tính mới.',
        command: 'setUser(prev => ({ ...prev, name: "Hieu" }));',
        expectedOutput: 'Thuộc tính name được cập nhật mà không làm mất age, email.',
        tips: '🔴 Tránh ghi đè trực tiếp `setUser({ name: "Hieu" })` vì sẽ xóa sạch các thuộc tính còn lại!',
      },
      {
        stepNumber: 4,
        title: 'Cập Nhật State Array (Thêm, Sửa, Xóa)',
        description: 'Sử dụng spread, filter, map để tạo mảng mới thay vì mutate mảng cũ bằng push/splice.',
        command: '// Thêm item:\nsetItems(prev => [...prev, newItem]);\n// Xóa item:\nsetItems(prev => prev.filter(item => item.id !== targetId));',
        expectedOutput: 'Mảng mới được gán cho state, trigger React re-render.',
      },
    ],
  },
  {
    id: 'react-hook-useeffect-masterclass',
    title: 'useEffect — Side Effects, Dependencies & Cleanup Masterclass',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    tags: ['React', 'useEffect', 'SideEffects', 'Cleanup', 'MemoryLeak'],
    difficulty: 'Beginner',
    type: 'concept',
    readingTimeMinutes: 11,
    summary: 'Phân tích chuyên sâu về useEffect: Cơ chế Mount/Unmount, Ý nghĩa Mảng Dependency (`[]` vs `[state]` vs No array), Hàm Cleanup chống rò rỉ bộ nhớ (Memory Leak), Stale Closures và quy tắc "Không phải mọi logic đều cần useEffect".',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { useState, useEffect } from 'react';

export function WindowResizeTracker() {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    
    // 1. Dán Event Listener khi Component Mount
    window.addEventListener('resize', handleResize);

    // 2. CLEANUP FUNCTION: Chạy trước khi effect chạy lại hoặc khi Component Unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // Mảng [] rỗng = Chỉ chạy 1 lần khi Mount

  return <div>Width: {windowWidth}px</div>;
}`,
        description: 'Ví dụ Cleanup Function xóa Event Listener ngăn ngừa rò rỉ bộ nhớ.',
      },
    ],
  },
  {
    id: 'react-hook-usecontext',
    title: 'useContext — Chia Sẻ State Giữa Các Component',
    categoryId: 'frontend',
    subcategoryId: 'frontend-props-state',
    tags: ['React', 'useContext', 'Context', 'GlobalState', 'Theme'],
    difficulty: 'Beginner',
    type: 'concept',
    readingTimeMinutes: 8,
    summary: 'Giải pháp chia sẻ dữ liệu toàn cục (Auth session, Theme, Language) không qua Prop Drilling với React Context: Provider, Consumer, `useContext` hook và kỹ thuật tối ưu chống re-render thừa.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { createContext, useContext, useState, ReactNode } from 'react';

interface ThemeContextType {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const toggleTheme = () => setTheme(t => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}`,
        description: 'Tạo ThemeContext và Custom Hook useTheme an toàn kiểu dữ liệu.',
      },
    ],
  },
  {
    id: 'react-hook-usereducer',
    title: 'useReducer — Quản Lý State Phức Tạp',
    categoryId: 'frontend',
    subcategoryId: 'frontend-props-state',
    tags: ['React', 'useReducer', 'Reducer', 'ReduxPattern', 'Step-by-Step'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    readingTimeMinutes: 10,
    summary: 'Hướng dẫn chuyển đổi từ useState sang useReducer khi State có nhiều hành động phức tạp (Complex Form, Shopping Cart): Cấu trúc Reducer, Action Types, Dispatch và State Transition chuẩn bất biến.',
    updatedAt: '2026-08-20',
    steps: [
      {
        stepNumber: 1,
        title: 'Định Nghĩa State & Action Types',
        description: 'Khai báo kiểu dữ liệu State và các loại Action có thể gửi tới Reducer.',
        command: `type TodoState = { id: string; text: string; completed: boolean }[];
type TodoAction = 
  | { type: 'ADD'; payload: string }
  | { type: 'TOGGLE'; payload: string };`,
        expectedOutput: 'Kiểu dữ liệu TypeScript cho Reducer sẵn sàng.',
      },
      {
        stepNumber: 2,
        title: 'Viết Thuần Hàm Reducer (Pure Function)',
        description: 'Tạo hàm nhận (state, action) và trả về state mới dựa trên action.type.',
        command: `function todoReducer(state: TodoState, action: TodoAction): TodoState {
  switch (action.type) {
    case 'ADD':
      return [...state, { id: Date.now().toString(), text: action.payload, completed: false }];
    case 'TOGGLE':
      return state.map(t => t.id === action.payload ? { ...t, completed: !t.completed } : t);
    default:
      return state;
  }
}`,
        expectedOutput: 'Hàm Reducer đảm bảo nguyên tắc thuần khiết (Pure function).',
      },
      {
        stepNumber: 3,
        title: 'Khởi Tạo Hook useReducer & Dispatch Action',
        description: 'Gọi useReducer trong Component và phát tin tín hiệu dispatch.',
        command: `const [todos, dispatch] = useReducer(todoReducer, []);
dispatch({ type: 'ADD', payload: 'Learn React Hooks' });`,
        expectedOutput: 'State todos được thêm phần tử mới thông qua Reducer.',
      },
    ],
  },
  {
    id: 'react-hook-useref',
    title: 'useRef — DOM Reference, Mutable Values & Avoiding Re-renders',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    tags: ['React', 'useRef', 'DOM', 'Mutable', 'Performance'],
    difficulty: 'Beginner',
    type: 'concept',
    readingTimeMinutes: 8,
    summary: 'Ứng dụng useRef trong React: Truy cập phần tử DOM thực tế (Focus input, Scroll, Canvas), lưu trữ giá trị biến đổi (Timer ID, Counter) mà KHÔNG gây re-render Component và so sánh useRef vs useState.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { useRef } from 'react';

export function AutoFocusInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<number | null>(null); // Lưu mutable timer ID mà không re-render

  const handleFocus = () => {
    inputRef.current?.focus(); // Truy cập DOM node trực tiếp
  };

  return (
    <div>
      <input ref={inputRef} type="text" placeholder="Type here..." />
      <button onClick={handleFocus}>Focus Input</button>
    </div>
  );
}`,
        description: 'Truy cập DOM phần tử input và lưu trữ Timer ID với useRef.',
      },
    ],
  },
  {
    id: 'react-hook-usememo-usecallback',
    title: 'useMemo & useCallback — Performance Optimization Without Premature Optimization',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-performance',
    tags: ['React', 'useMemo', 'useCallback', 'Performance', 'Memoization'],
    difficulty: 'Intermediate',
    type: 'concept',
    readingTimeMinutes: 11,
    summary: 'Phân tích chuyên sâu kỹ thuật Memoization trong React: Ghi nhớ giá trị tính toán nặng (`useMemo`), giữ ổn định tham chiếu hàm (`useCallback`), kết hợp `React.memo` và nguyên tắc KHÔNG lạm dụng tối ưu hóa sớm (Premature Optimization).',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { useState, useMemo, useCallback } from 'react';

export function UserSearchList({ users }: { users: User[] }) {
  const [query, setQuery] = useState('');

  // 1. useMemo: Ghi nhớ kết quả lọc mảng nặng, chỉ tính lại khi query hoặc users đổi
  const filteredUsers = useMemo(() => {
    return users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()));
  }, [users, query]);

  // 2. useCallback: Giữ nguyên tham chiếu hàm handleClick truyền xuống Child Component
  const handleSelect = useCallback((id: string) => {
    console.log('Selected user:', id);
  }, []); // Dependency [] rỗng = Hàm không bao giờ bị tạo mới

  return (
    <div>
      <input value={query} onChange={e => setQuery(e.target.value)} />
      <UserList items={filteredUsers} onSelect={handleSelect} />
    </div>
  );
}`,
        description: 'Kết hợp useMemo lọc danh sách và useCallback ổn định hàm callback.',
      },
    ],
  },
  {
    id: 'react-hook-advanced-concurrent',
    title: 'Advanced Concurrent & Concurrent Mode Hooks (useLayoutEffect, useId, useTransition, useDeferredValue, useSyncExternalStore, useImperativeHandle)',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    tags: ['React', 'Advanced', 'Concurrent', 'useTransition', 'useLayoutEffect', 'useId'],
    difficulty: 'Advanced',
    type: 'concept',
    readingTimeMinutes: 14,
    summary: 'Cẩm nang 6 React Hooks nâng cao chuyên biệt: `useLayoutEffect` (đo đạc DOM đồng bộ chống nhấp nháy UI), `useId` (sinh ID ổn định cho Accessibility & SSR), `useTransition` & `useDeferredValue` (phân loại tác vụ khẩn cấp & phi khẩn cấp), `useSyncExternalStore` (kết nối State Store ngoài) và `useImperativeHandle` (mở rộng API cho parent qua ref).',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'tsx',
        code: `import { useState, useTransition, useDeferredValue } from 'react';

export function ConcurrentSearch() {
  const [input, setInput] = useState('');
  const [isPending, startTransition] = useTransition();
  const deferredInput = useDeferredValue(input); // Trì hoãn giá trị biến đổi cho component nặng

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Tác vụ khẩn cấp: Cập nhật ô nhập văn bản ngay lập tức
    setInput(e.target.value);

    // Tác vụ không khẩn cấp: Lọc 10,000 dữ liệu chạy ngầm không làm đơ bàn phím
    startTransition(() => {
      // Non-urgent state update
    });
  };

  return (
    <div>
      <input value={input} onChange={handleChange} />
      {isPending && <span>Đang tìm kiếm...</span>}
      <HeavyList query={deferredInput} />
    </div>
  );
}`,
        description: 'Tối ưu UI phản hồi mượt mà với useTransition và useDeferredValue.',
      },
    ],
  },
  {
    id: 'react-custom-hooks-masterclass',
    title: 'Custom Hooks — Tái Sử Dụng Logic React Đúng Cách (useDebounce, useFetch, useAuth)',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-vite-production',
    tags: ['React', 'CustomHooks', 'useDebounce', 'useFetch', 'Architecture'],
    difficulty: 'Intermediate',
    type: 'step_by_step',
    readingTimeMinutes: 11,
    summary: 'Quy trình thiết kế Custom Hooks chuyên nghiệp: Đóng gói logic có trạng thái (Stateful Logic), chuẩn hóa tên `useXxx`, tham số đầu vào và giá trị trả về. Thực hành xây dựng `useDebounce` chống spam API và `useFetch` xử lý loading/error.',
    updatedAt: '2026-08-20',
    steps: [
      {
        stepNumber: 1,
        title: 'Xây Dựng Custom Hook useDebounce Hoàn Chỉnh',
        description: 'Trì hoãn việc phát sự kiện cho đến khi người dùng ngừng gõ văn bản trong khoảng thời gian delay.',
        command: `import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}`,
        expectedOutput: 'Custom hook useDebounce hoạt động chuẩn xác với Type Safety.',
      },
      {
        stepNumber: 2,
        title: 'Áp Dụng Custom Hook Trong Component Ô Tìm Kiếm',
        description: 'Sử dụng useDebounce để chỉ gọi API sau khi user dừng gõ 500ms.',
        command: `const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 500);

useEffect(() => {
  if (debouncedSearch) {
    apiSearch(debouncedSearch);
  }
}, [debouncedSearch]);`,
        expectedOutput: 'Số lượng request API giảm từ 20 request xuống còn 1 request duy nhất.',
      },
    ],
  },
  {
    id: 'react-hooks-cheatsheet',
    title: 'React Hooks Cheatsheet — Chọn Hook Nào Trong Tình Huống Nào?',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-hooks',
    isBookmarked: true,
    tags: ['React', 'Hooks', 'Cheatsheet', 'Matrix', 'DecisionTree'],
    difficulty: 'Beginner',
    type: 'cheatsheet',
    readingTimeMinutes: 6,
    summary: 'Bảng tra cứu ma trận lựa chọn React Hook chuẩn xác cho 14 bài toán lập trình thường gặp trong công việc hàng ngày.',
    updatedAt: '2026-08-20',
    snippets: [
      {
        language: 'markdown',
        code: `| Bài Toán Thực Tế | Hook Nên Sử Dụng | Mức Độ |
| :--- | :--- | :--- |
| Quản lý state đơn giản (Biến, Form input, Boolean) | \`useState\` | Beginner |
| Quản lý state phức tạp (Nhiều action, Todo, Cart) | \`useReducer\` | Intermediate |
| Xử lý Side-Effect (Call API, Event listener, Timer) | \`useEffect\` | Beginner |
| Chia sẻ State toàn cục không qua props (Theme, Auth) | \`useContext\` | Beginner |
| Truy cập DOM Node hoặc Lưu giá trị không re-render | \`useRef\` | Beginner |
| Ghi nhớ kết quả tính toán nặng (Filter/Sort mảng) | \`useMemo\` | Intermediate |
| Giữ ổn định tham chiếu hàm cho Child Component | \`useCallback\` | Intermediate |
| Đo đạc vị trí/kích thước DOM đồng bộ (Tránh nhấp nháy UI) | \`useLayoutEffect\` | Advanced |
| Sinh ID duy nhất ổn định cho Form Accessibility & SSR | \`useId\` | Advanced |
| Giữ UI mượt khi tìm kiếm danh sách cực lớn | \`useTransition\` / \`useDeferredValue\` | Advanced |
| Kết nối với State Store ngoài (Redux/Zustand internal) | \`useSyncExternalStore\` | Advanced |
| Đóng gói Imperative API cho Parent qua \`forwardRef\` | \`useImperativeHandle\` | Advanced |
| Đóng gói logic tái sử dụng giữa nhiều Component | \`Custom Hook (useXxx)\` | Intermediate |`,
        description: 'Ma trận quyết định lựa chọn Hook phù hợp ngữ cảnh.',
      },
    ],
  },
  {
    id: 'react-hooks-top-mistakes-debugging',
    title: 'React Hooks — Top 10 Mistakes & Debugging Guide',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-debugging',
    tags: ['React', 'Hooks', 'Troubleshooting', 'Debugging', 'StaleClosure', 'InfiniteLoop'],
    difficulty: 'Intermediate',
    type: 'troubleshoot',
    readingTimeMinutes: 12,
    summary: 'Danh mục khắc phục 10 sai lầm kinh điển khi dùng React Hooks: Invalid Hook Call, Infinite useEffect Loop, Stale Closures, Mutating State trực tiếp, Lạm dụng useMemo/useCallback và Context Re-render Overload.',
    updatedAt: '2026-08-20',
    commonErrors: [
      {
        errorCode: 'Error: Invalid hook call. Hooks can only be called inside of the body of a function component.',
        cause: 'Gọi Hook bên trong câu lệnh `if`, vòng lặp `for`, hoặc trong hàm helper thông thường.',
        solution: 'Di chuyển toàn bộ lời gọi Hook lên vị trí Top-Level đầu tiên của Functional Component.',
        commandFix: '// Code sai: if (isReady) useEffect(...)\n// Code đúng: useEffect(() => { if (isReady) ... }, [isReady])',
      },
      {
        errorCode: 'Uncaught Error: Too many re-renders. React limits the number of renders to prevent an infinite loop.',
        cause: 'Truyền trực tiếp lời gọi setter vào prop sự kiện thay vì truyền arrow function.',
        solution: 'Chuyển `onClick={setCount(count + 1)}` thành `onClick={() => setCount(count + 1)}`.',
        commandFix: 'onClick={() => setCount(prev => prev + 1)}',
      },
      {
        errorCode: 'Infinite useEffect loop (Call API liên tục không dừng)',
        cause: 'Đặt biến object/array mới khởi tạo trong render body làm dependency cho useEffect.',
        solution: 'Sử dụng primitive values trong dependency array hoặc bọc object/array bằng useMemo.',
        commandFix: 'useEffect(() => { fetchData() }, [id]); // Dùng ID primitive thay vì object options',
      },
      {
        errorCode: 'Stale Closure (Biến state trong setInterval/setTimeout bị "đóng băng" giá trị cũ)',
        cause: 'Callback trong timer đóng (close over) giá trị state của lượt render ban đầu do mảng dependency rỗng.',
        solution: 'Sử dụng Functional Update `setCount(prev => prev + 1)` hoặc dùng `useRef` giữ giá trị mới nhất.',
        commandFix: 'useEffect(() => { const timer = setInterval(() => setCount(p => p + 1), 1000); return () => clearInterval(timer); }, [])',
      },
    ],
  },
  {
    id: 'react-hooks-production-architecture',
    title: 'React Hooks trong Production — Từ Component đến Architecture',
    categoryId: 'frontend',
    subcategoryId: 'frontend-react-vite-production',
    tags: ['React', 'Hooks', 'Production', 'Architecture', 'Runbook'],
    difficulty: 'Advanced',
    type: 'runbook',
    readingTimeMinutes: 13,
    summary: 'Kiến trúc kết hợp đồng bộ chuỗi React Hooks trong một tính năng thực tế ở môi trường Production: Từ User Input -> useState -> useDebounce -> useEffect (API) -> useMemo (Filter) -> useCallback (Item Selection) -> Dynamic UI Rendering.',
    updatedAt: '2026-08-20',
    architectureDiagram: `================================================================================
               PRODUCTION FEATURE ARCHITECTURE VIA REACT HOOKS
================================================================================
 User Keyboard Input
        │
        ▼
 [1. useState]: Holds raw input string (Immediate UI update)
        │
        ▼
 [2. useDebounce Custom Hook]: Delays value propagation by 400ms
        │
        ▼
 [3. useEffect]: Triggers Async API Fetching (with AbortController cleanup)
        │
        ▼
 [4. useState]: Holds raw API response data & loading/error states
        │
        ▼
 [5. useMemo]: Computes filtered/sorted view models (Expensive calculation)
        │
        ▼
 [6. useCallback]: Provides stable event handler references for child items
        │
        ▼
 [7. UI Render]: React.memo Child Components render without unnecessary updates!`,
    prerequisites: [
      'Thành thạo các React Hooks cơ bản và nâng cao',
      'Hiểu kiến trúc thiết kế ứng dụng Web React quy mô lớn',
    ],
  },
];



