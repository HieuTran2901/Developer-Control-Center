import { GuideChapter } from '../domain/entities/GuideChapter';

export const DEMO_DOCKER_CHAPTER: GuideChapter = {
  id: 'docker-containers-chapter',
  articleId: 'docker-cli-cheatsheet',
  chapterNumber: 3,
  totalChapters: 8,
  title: '3. Docker Containers',
  subtitle: 'Learn how containers work and how to manage their lifecycle.',
  categoryName: 'Docker & DevOps',
  subcategoryName: 'Docker Fundamentals',
  learningObjectives: [
    'What is a container and virtualized process isolation',
    'Container lifecycle (Create, Start, Stop, Pause, Remove)',
    'Essential Docker CLI commands for daily engineering tasks',
    'Inspect container metadata and debug runtime failures',
  ],
  sections: [
    {
      id: 'sec-3-1',
      title: '3.1 What is a Container?',
      content:
        'A container is a lightweight, standalone, executable package that includes everything needed to run a piece of software: application code, runtime environment, system tools, system libraries, and settings.',
      whyItMatters:
        'Containers ensure your application runs the exact same way everywhere: your laptop, staging server, or production cloud infrastructure.',
    },
    {
      id: 'sec-3-2',
      title: '3.2 Run Your First Container',
      content:
        'Khởi chạy một Web Server Nginx trong môi trường container cách ly hoàn toàn với máy host.',
      whyItMatters:
        'We run a container to create an isolated, reproducible execution environment for our application without modifying local system packages.',
      commands: [
        {
          command: 'docker run -d --name my-nginx -p 8080:80 nginx',
          description: 'Khởi chạy container Nginx ngầm (detached) và map cổng 8080 host sang 80 container.',
          expectedResult:
            'Container status should start in background and be accessible on http://localhost:8080',
          verificationCommand: 'docker ps',
          verificationCheck:
            'Container my-nginx status is "Up" and port mapping 0.0.0.0:8080->80/tcp is displayed.',
        },
      ],
      commonMistakes: [
        {
          problem: 'Port 8080 is already in use (EADDRINUSE)',
          why: 'Một tiến trình khác (Node.js, Web Server cũ, Tomcat) đang chiếm giữ cổng 8080 trên máy host.',
          fix: 'Đổi port map thành -p 8081:80 hoặc dùng netstat / Task Manager ngắt tiến trình chiếm cổng.',
        },
        {
          problem: 'Image "nginx" is missing locally',
          why: 'Lần đầu chạy Docker chưa có image nginx trong local cache.',
          fix: 'Docker CLI sẽ tự động tải (pull) image nginx từ Docker Hub công khai.',
        },
        {
          problem: 'Container exits immediately with status Exit Code 0 or 1',
          why: 'Tiến trình chính trong container không chạy ở background mode hoặc gặp lỗi khởi động.',
          fix: 'Đảm bảo cờ -d được bật và kiểm tra log bằng docker logs my-nginx.',
        },
      ],
    },
    {
      id: 'sec-3-3',
      title: '3.3 Container Lifecycle',
      content:
        'Vòng đời container trải qua 5 trạng thái chính: Created ➔ Running ➔ Paused ➔ Stopped ➔ Exited / Removed.',
      whyItMatters:
        'Hiểu vòng đời giúp developer quản lý bộ nhớ RAM/CPU và tài nguyên đĩa cứng không bị phình to do các container vô danh.',
      commands: [
        {
          command: 'docker stop my-nginx && docker start my-nginx',
          description: 'Dừng tạm thời và khởi động lại container my-nginx.',
          expectedResult: 'Container dừng an toàn và được kích hoạt lại trạng thái Running.',
        },
        {
          command: 'docker rm -f my-nginx',
          description: 'Xóa ép buộc container khỏi danh sách hệ thống.',
          expectedResult: 'Container my-nginx bị giải phóng khỏi tài nguyên máy.',
        },
      ],
    },
    {
      id: 'sec-3-4',
      title: '3.4 Essential Commands',
      content:
        'Các câu lệnh thiết yếu developer cần ghi nhớ khi thao tác với Docker hàng ngày.',
      commands: [
        {
          command: 'docker ps -a',
          description: 'Liệt kê toàn bộ container (bao gồm cả container đã dừng Exited).',
        },
        {
          command: 'docker logs --tail 100 -f my-nginx',
          description: 'Theo dõi trực tiếp (stream) 100 dòng log mới nhất của container.',
        },
        {
          command: 'docker exec -it my-nginx bash',
          description: 'Truy cập trực tiếp vào shell bên trong container đang chạy.',
        },
      ],
    },
    {
      id: 'sec-3-5',
      title: '3.5 Inspect & Debug',
      content:
        'Kỹ thuật xem chi tiết thông số mạng, biến môi trường và tài nguyên tiêu thụ.',
      commands: [
        {
          command: 'docker inspect my-nginx',
          description: 'Xuất toàn bộ cấu hình JSON chi tiết của container (IP address, mounts, env).',
        },
        {
          command: 'docker stats --no-stream',
          description: 'Đo đạc mức độ tiêu thụ CPU, RAM, Network I/O của các container.',
        },
      ],
    },
    {
      id: 'sec-3-6',
      title: '3.6 Summary',
      content:
        'Bạn đã hoàn thành Chương 3: Khởi chạy Nginx Container thành công, làm chủ các lệnh lifecycle, kiểm tra logs và sẵn sàng chuyển sang Chương 4: Docker Images & Multi-Stage Builds.',
    },
  ],
  nextChapterId: 'docker-images-chapter',
  nextChapterTitle: '4. Docker Images & Layer Caching',
  prevChapterId: 'docker-fundamentals-chapter',
  prevChapterTitle: '2. Docker Architecture',
};

export const GUIDE_CHAPTERS: Record<string, GuideChapter> = {
  'docker-containers-chapter': DEMO_DOCKER_CHAPTER,
  'docker-cli-cheatsheet': DEMO_DOCKER_CHAPTER,
};
