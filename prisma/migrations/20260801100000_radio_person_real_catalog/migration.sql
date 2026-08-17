-- 用真实无线电人物目录替换旧版占位条目（无线电贡献者 001~120）。
-- 仅更新仍为占位名称的行，不覆盖管理员通过界面自定义的名称与资料。

UPDATE `RadioPerson`
SET `name` = '麦克斯韦（James Clerk Maxwell）', `profile` = '英国物理学家（1831—1879），用“麦克斯韦方程组”统一电与磁，预言电磁波以光速传播，为无线电奠定理论基础。性格特点：思维深邃、谦逊专注，习惯用数学书写自然规律。榜样点：扎实的基础科学，是改变世界的起点。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-001' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '赫兹（Heinrich Hertz）', `profile` = '德国物理学家（1857—1894），1888年首次用实验产生并接收电磁波，证实麦克斯韦的预言，频率单位“赫兹”以他命名。性格特点：严谨专注、亲手验证每一个假设。榜样点：动手实验，是通往真理的第一步。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-002' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '多普勒（Christian Doppler）', `profile` = '奥地利数学家、物理学家（1803—1853），提出波源与观察者相对运动时频率改变的多普勒效应，成为雷达测速、卫星导航与射电天文的基础。性格特点：善于从平凡现象中发现规律。榜样点：生活中藏着科学，细心观察就会看见。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-003' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '莫尔斯（Samuel Morse）', `profile` = '美国发明家（1791—1872），原为画家，中年转攻电报，发明莫尔斯电码并建成第一条长途电报线，开启电气通信时代。性格特点：锲而不舍、善于化繁为简。榜样点：热爱的力量可以让人在任何年龄重新出发。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-004' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '贝尔（Alexander Graham Bell）', `profile` = '美国发明家（1847—1922），1876年发明电话并创立贝尔电话公司，毕生热心帮助听障人士沟通。性格特点：好奇心旺盛、富有同情心。榜样点：好发明不只改变技术，更要温暖人心。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-005' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '爱迪生（Thomas Edison）', `profile` = '美国发明家（1847—1931），改进碳粒送话器，发明留声机与白炽灯，用“发明工厂”模式点亮电气时代。性格特点：百折不挠，坚信天才来自勤奋。榜样点：每一次失败，都是在为成功铺路。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-006' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '亥维赛（Oliver Heaviside）', `profile` = '英国工程师、数学家（1850—1925），自学成才，用向量分析改写麦克斯韦方程，建立电报传输理论并预言电离层存在。性格特点：特立独行、甘于清贫。榜样点：自律与热爱，是最好的老师。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-007' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '洛奇（Oliver Lodge）', `profile` = '英国物理学家（1851—1940），1894年演示无线电接收并发明调谐方法，使电台之间能“各行其道”，还热心科学传播。性格特点：博学多才、乐于分享。榜样点：把知识讲给别人听，自己会理解得更深。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-008' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '波波夫（Alexander Popov）', `profile` = '俄国物理学家（1859—1906），制成本土最早的电磁波接收装置并用于雷电探测，与马可尼并称无线电先驱。性格特点：谦逊务实，心系海上与偏远地区的人们。榜样点：科学的意义，在于守护人的安全。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-009' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '布兰利（Édouard Branly）', `profile` = '法国物理学家（1844—1940），发明金属屑检波器，成为早期无线电报接收机的核心器件。性格特点：专注实验、淡泊名利。榜样点：看似微小的基础器件，往往是伟大发明的基石。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-010' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '玻色（Jagadish Chandra Bose）', `profile` = '印度物理学家（1858—1937），率先开展毫米波实验，制成半导体晶体检波器，是微波与半导体研究的先驱之一。性格特点：跨学科、敢闯无人区。榜样点：科学的舞台属于每一个勇于探索的人。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-011' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '马可尼（Guglielmo Marconi）', `profile` = '意大利发明家（1874—1937），把无线电报推向远洋，1901年实现跨大西洋通信，与布劳恩同获1909年诺贝尔物理学奖，1920年获IEEE荣誉奖章。性格特点：执着而有组织力，把设想变成实用系统。榜样点：从实验室到造福世界，还差一份坚持。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-012' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '布劳恩（Karl Ferdinand Braun）', `profile` = '德国物理学家（1850—1918），改进无线电报发射电路，发明阴极射线管（布劳恩管），与马可尼同获1909年诺贝尔物理学奖。性格特点：理论扎实、长于工程。榜样点：理论与动手结合，发明才能走远。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-013' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '特斯拉（Nikola Tesla）', `profile` = '塞尔维亚裔美国发明家（1856—1943），发明交流电机系统与特斯拉线圈，开创高频无线电与无线输电研究。性格特点：想象力奔放、工作极度专注。榜样点：大胆想象，并用一生去实现它。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-014' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '费森登（Reginald Fessenden）', `profile` = '加拿大裔美国发明家（1866—1932），1906年平安夜首次实现无线电语音广播，被誉为“广播之父”，获1921年IEEE荣誉奖章。性格特点：敢于挑战主流、独立钻研。榜样点：不走寻常路，常常能打开新天地。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-015' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '弗莱明（John Ambrose Fleming）', `profile` = '英国电气工程师（1849—1945），1904年发明真空二极管，开启电子管与电子学时代，获1933年IEEE荣誉奖章。性格特点：学识渊博、善于总结前人成果。榜样点：站在前人的肩膀上，才能看得更远。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-016' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '德福雷斯特（Lee de Forest）', `profile` = '美国发明家（1873—1961），1906年发明三极真空管“奥丁管”，让微弱信号能被放大，获1922年IEEE荣誉奖章。性格特点：屡败屡战、百折不挠。榜样点：一枚小管子，放大了整个时代的信号。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-017' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '阿姆斯特朗（Edwin Armstrong）', `profile` = '美国工程师（1890—1954），发明再生电路、超外差接收机与调频广播（FM），获1917年首届IEEE荣誉奖章。性格特点：执着捍卫自己的发明，一生与争议相伴。榜样点：真正的创新，往往要熬过漫长的等待。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-018' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '亚历山大森（Ernst Alexanderson）', `profile` = '瑞典裔美国工程师（1878—1975），发明高频发电机实现连续波无线电报，后成为电视扫描先驱，获1919年IEEE荣誉奖章。性格特点：沉稳专注、一生深耕。榜样点：把一件事做到极致，就是伟大。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-019' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '萨尔诺夫（David Sarnoff）', `profile` = '俄裔美国企业家（1891—1971），从无线电报务员成长为RCA总裁，推动收音机、电视走进千家万户。性格特点：眼光长远、敢抓机遇。榜样点：懂技术又懂人心的人，能让发明改变亿万人的生活。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-020' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '普平（Michael Pupin）', `profile` = '塞尔维亚裔美国物理学家（1858—1935），发明加感线圈延长电话信号传输距离，获1924年IEEE荣誉奖章。性格特点：从移民苦孩子到科学家，勤奋感恩。榜样点：出身不能决定未来，努力可以。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-021' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '皮卡德（Greenleaf Whittier Pickard）', `profile` = '美国工程师（1877—1956），发明晶体检波器，让矿石收音机普及千家万户，获1926年IEEE荣誉奖章。性格特点：善于实验、乐于普及技术。榜样点：简单而便宜的技术，同样能点亮世界。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-022' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '范德波尔（Balthasar van der Pol）', `profile` = '荷兰物理学家（1889—1959），提出描述电子振荡的“范德波尔方程”，影响锁相与非线性电路研究，获1935年IEEE荣誉奖章。性格特点：数学功底深厚、爱提炼规律。榜样点：数学是工程师的“望远镜”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-023' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '曾内克（Jonathan Zenneck）', `profile` = '德国物理学家（1871—1959），研究地波与天波传播理论，著无线电技术经典教材，获1928年IEEE荣誉奖章。性格特点：治学严谨、倾心育人。榜样点：传播知识，本身就是了不起的贡献。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-024' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '坎贝尔（George Ashley Campbell）', `profile` = '美国工程师（1870—1954），独立发明电气滤波器，奠定载波通信与频率选择理论，获1936年IEEE荣誉奖章。性格特点：理论联系实际、耐得住寂寞。榜样点：看不见的数学，变成看得见的通信便利。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-025' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '康拉德（Frank Conrad）', `profile` = '美国工程师（1874—1941），业余电台先驱，在自家车库定期播送节目，促成1920年世界首座商业广播电台KDKA开播。性格特点：热爱动手、乐于分享。榜样点：爱好可以长成改变世界的事业。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-026' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '兹沃里金（Vladimir Zworykin）', `profile` = '俄裔美国工程师（1888—1982），发明光电摄像管与显像管，推动电子电视走向实用，被誉为“电视之父”之一。性格特点：视野宏大、锲而不舍。榜样点：把一个个零件拼起来，就能拼出整个世界。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-027' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '法恩斯沃思（Philo Farnsworth）', `profile` = '美国发明家（1906—1971），少年时构想了电子电视，1927年成功传送第一幅电子电视图像。性格特点：早慧执着、白手起家。榜样点：梦想不分年龄，认真对待就会开花。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-028' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '贝尔德（John Logie Baird）', `profile` = '英国发明家（1888—1946），1926年公开演示机械扫描电视，参与开创英国电视广播。性格特点：敢想敢试、屡败屡战。榜样点：先跑起来的实验，来自最朴素的坚持。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-029' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '杜蒙（Allen B. DuMont）', `profile` = '美国工程师（1901—1965），改进阴极射线管并大规模生产电视机，创建杜蒙电视网。性格特点：精益求精、重视质量。榜样点：把画面做清晰，人们才愿意看下去。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-030' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '八木秀次（Hidetsugu Yagi）', `profile` = '日本电气工程师（1886—1976），与宇田新太郎共同发明高增益八木—宇田定向天线，广泛用于雷达、电视与业余无线电。性格特点：善于发现并推动学生的成果。榜样点：师生互相成就，科学需要传承。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-031' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '宇田新太郎（Shintaro Uda）', `profile` = '日本电气工程师（1896—1976），设计并实验引向型定向天线，是八木—宇田天线的核心发明人。性格特点：踏实实验、甘于幕后。榜样点：很多伟大成果的名字背后，都有默默耕耘者。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-032' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '里思（John Reith）', `profile` = '英国广播事业家（1889—1971），BBC首任总经理，确立公共服务广播理念，让广播成为教育与文化的力量。性格特点：信念坚定、严于自律。榜样点：做传播的人，先要明白传播为了谁。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-033' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '默罗（Edward R. Murrow）', `profile` = '美国广播新闻先驱（1908—1965），二战期间从伦敦现场报道，开创严肃广播新闻与电视新闻传统。性格特点：正直勇敢、忠于事实。榜样点：拿起话筒之前，先要有讲真话的勇气。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-034' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '沃森-瓦特（Robert Watson-Watt）', `profile` = '英国物理学家（1892—1973），主持研制世界上最早实用雷达系统“本土链”，在二战中守护英国领空。性格特点：务实高效、危难中敢担当。榜样点：关键时刻的技术，能守护千万人的安全。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-035' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '泰勒（Albert Hoyt Taylor）', `profile` = '美国工程师（1879—1961），美国海军研究实验室雷达先驱，1922年发现飞机反射无线电波的现象。性格特点：治学严谨、善带团队。榜样点：偶然的发现，需要有心人紧紧抓住。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-036' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '杨（Leo C. Young）', `profile` = '美国工程师（1891—1981），与泰勒合作完成雷达反射实验，1930年研制出探测飞机的脉冲雷达装置。性格特点：低调务实、甘当幕后英雄。榜样点：伟大的团队，离不开可靠的伙伴。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-037' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '斯宾塞（Percy Spencer）', `profile` = '美国工程师（1894—1970），在雷达磁控管实验中偶然发现微波能加热食物，1945年发明微波炉。性格特点：自学成才、好奇心极强。榜样点：意外的发现，只垂青随时思考的人。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-038' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '阿尔瓦雷茨（Luis Alvarez）', `profile` = '美国物理学家（1911—1988），二战期间参与MIT雷达与雷达信标研制，1968年获诺贝尔物理学奖。性格特点：思维活跃、善于跨界。榜样点：基础科学扎实，危急时刻就能派上用场。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-039' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '格廷（Ivan Getting）', `profile` = '美国电气工程师（1912—2003），领导MIT辐射实验室雷达工作，后参与提出全球定位系统（GPS）构想。性格特点：组织力强、目光超前。榜样点：工程师既要会做，也要会想未来。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-040' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '佩奇（Robert Morris Page）', `profile` = '美国物理学家（1903—1992），在海军研究实验室研制成功美国第一部脉冲雷达并发展单脉冲技术。性格特点：专注深邃、耐得重复。榜样点：看不见的电磁波，需要耐心才能“看见”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-041' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '克劳斯（John Kraus）', `profile` = '美国物理学家、天线专家（1910—2004），呼号W8JK，撰写天线理论经典教材，建造射电望远镜，是射电天文先驱。性格特点：理论动手兼备、乐于科普。榜样点：既会算又会焊，才是完整的工程师。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-042' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '朗缪尔（Irving Langmuir）', `profile` = '美国化学家、物理学家（1881—1957），改进高真空电子管并研究电子管物理，1932年获诺贝尔化学奖。性格特点：观察细致、爱问“为什么”。榜样点：每一个“为什么”，都可能通向一座奖杯。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-043' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '阿普尔顿（Edward Appleton）', `profile` = '英国物理学家（1892—1965），用无线电实验证实电离层存在，为远距离短波通信奠基，1947年获诺贝尔物理学奖。性格特点：实验设计精巧、一生热爱无线电。榜样点：天空中的“镜子”，让电波传遍全球。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-044' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '肖克利（William Shockley）', `profile` = '美国物理学家（1910—1989），1947年与巴丁、布拉顿共同发明晶体管，1956年获诺贝尔物理学奖，推动硅谷诞生。性格特点：才华横溢、个性鲜明。榜样点：再聪明的人，也需要与团队同行。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-045' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '巴丁（John Bardeen）', `profile` = '美国物理学家（1908—1991），晶体管共同发明人，1956年与1972年两次获诺贝尔物理学奖。性格特点：温和谦逊、深藏不露。榜样点：静水流深，专注比张扬更有力量。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-046' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '布拉顿（Walter Brattain）', `profile` = '美国物理学家（1902—1987），与肖克利、巴丁共同发明晶体管，1956年获诺贝尔物理学奖，实验技艺精湛。性格特点：动手能力极强、爽朗直率。榜样点：灵巧的双手和缜密的头脑同样重要。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-047' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '基尔比（Jack Kilby）', `profile` = '美国工程师（1923—2005），1958年发明集成电路，把许多元件做进同一片半导体，2000年获诺贝尔物理学奖。性格特点：安静内敛、专注解决难题。榜样点：化繁为简，是工程师的大智慧。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-048' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '诺伊斯（Robert Noyce）', `profile` = '美国工程师、企业家（1927—1990），独立发明平面集成电路，联合创办仙童与英特尔，被誉为“硅谷市长”。性格特点：技术与组织兼备、善用人才。榜样点：好创意要变成好产品，还需要勇敢的组织者。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-049' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '高锟（Charles Kuen Kao）', `profile` = '华裔电机工程学家（1933—2018），生于上海。1966年提出用高纯度玻璃光纤传输光信号，被誉为“光纤之父”，2009年获诺贝尔物理学奖，1985年获马可尼奖。性格特点：温文尔雅、敢坚持“不可能”。榜样点：一根细光纤，连接起整个世界。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-050' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '汤斯（Charles Townes）', `profile` = '美国物理学家（1915—2015），发明微波激射器并推动激光问世，1964年获诺贝尔物理学奖。性格特点：好奇心不灭、谦和待人。榜样点：驯服了微波，人类就多了一双眼睛。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-051' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '肖洛（Arthur Schawlow）', `profile` = '美国物理学家（1921—1999），与汤斯共同提出激光原理，1981年获诺贝尔物理学奖，1977年获马可尼奖。性格特点：幽默开朗、长于启发学生。榜样点：会讲笑话的科学家，往往更会讲科学。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-052' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '加博尔（Dennis Gabor）', `profile` = '匈牙利裔英国工程师（1900—1979），1947年发明全息摄影原理，1971年获诺贝尔物理学奖。性格特点：视野开阔、善于跨界。榜样点：通信与信息的思想，可以照亮整个物理学。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-053' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '香农（Claude Shannon）', `profile` = '美国数学家、工程师（1916—2001），1948年发表《通信的数学理论》创立信息论，奠定数字通信基础。性格特点：童心未泯、爱“玩”数学。榜样点：爱玩的孩子，也能玩出改变世界的理论。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-054' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '奈奎斯特（Harry Nyquist）', `profile` = '瑞典裔美国工程师（1889—1976），提出采样定理与奈奎斯特判据，是数字通信与控制系统的基石。性格特点：安静专注、长于把工程问题数学化。榜样点：把“够快够稳”想清楚，通信就不会乱。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-055' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '哈特利（Ralph Hartley）', `profile` = '美国工程师（1888—1970），发明哈特利振荡器，最早提出用对数度量信息量，是信息论先声。性格特点：思路清晰、乐于分享。榜样点：信息也可以“称一称、量一量”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-056' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '布莱克（Harold S. Black）', `profile` = '美国工程师（1898—1983），1927年在渡轮上构思负反馈放大器，大幅降低失真，成为现代电子设备的基石。性格特点：勤于思考、把灵感变成严谨方案。榜样点：灵光一闪之后，还要有十年的功夫。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-057' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '博德（Hendrik Bode）', `profile` = '美国工程师（1905—1982），提出博德图分析放大器与控制系统，成为教科书里的基本工具。性格特点：深入浅出、化繁为简。榜样点：一张图，让复杂系统一目了然。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-058' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '维纳（Norbert Wiener）', `profile` = '美国数学家（1894—1964），创立控制论，统一通信、反馈与自动控制思想，深刻影响雷达与计算机。性格特点：博学多思、个性鲜明。榜样点：学科交叉处，常是创新的富矿。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-059' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '维特比（Andrew Viterbi）', `profile` = '美国工程师（1935年生），发明维特比算法用于数字通信纠错，联合创办高通公司，1990年获马可尼奖。性格特点：理论扎实、善把数学变产品。榜样点：一条优雅的算法，让亿万手机通话更清晰。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-060' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '雅各布斯（Irwin Jacobs）', `profile` = '美国工程师（1933年生），联合创办高通公司，主导CDMA移动通信技术，2011年获马可尼奖。性格特点：敢想敢干、执着于标准。榜样点：敢于制定“规则”，技术就能走向世界。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-061' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '拉基（Robert W. Lucky）', `profile` = '美国通信工程师（1936年生），贝尔实验室研究员，发明自适应均衡器，著有通信经典教材，1987年获马可尼奖。性格特点：文笔幽默、长于传播思想。榜样点：把复杂道理讲简单，是工程师的本事。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-062' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '贝鲁（Claude Berrou）', `profile` = '法国电子工程师（1951年生），1993年发明涡轮码，使数字通信逼近香农极限，用于3G/4G/5G与卫星通信。性格特点：大胆假设、严谨验证。榜样点：敢于挑战“极限”，人类才能前进。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-063' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '库珀（Martin Cooper）', `profile` = '美国工程师（1928年生），1973年用摩托罗拉手机打出世界上第一通移动电话，被称为“手机之父”。性格特点：敢于打破常规、热情洋溢。榜样点：敢想“边走边打电话”，才有了今天的手机。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-064' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '恩格尔（Joel S. Engel）', `profile` = '美国工程师（1936年生），贝尔实验室蜂窝移动通信项目负责人之一，与库珀团队同期竞逐手机技术。性格特点：严谨系统、长于团队协作。榜样点：伟大的工程来自团队，而不是单打独斗。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-065' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '乔尔（Amos E. Joel Jr.）', `profile` = '美国工程师（1918—2008），发明蜂窝移动电话越区切换机制，让通话随人移动而不中断。性格特点：谦逊低调、一生钻研。榜样点：让技术“跟随”人移动，才真正方便了人。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-066' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '弗兰克尔（Richard Frenkiel）', `profile` = '美国工程师（1943年生），参与设计贝尔实验室早期蜂窝系统架构与频率复用方案。性格特点：长于系统设计、耐心细致。榜样点：看不见的网络架构，是看得见畅通的保障。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-067' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '艾布拉姆森（Norm Abramson）', `profile` = '美国工程师（1932—2020），发明ALOHAnet，让多台计算机共享无线信道，是无线局域网与互联网的雏形。性格特点：勇于实验、不拘一格。榜样点：海岛上的实验，长出了全球的网络森林。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-068' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '海斯（Vic Hayes）', `profile` = '荷兰裔美国工程师（1941年生），主持制定IEEE 802.11无线局域网标准，被称为“Wi-Fi之父”。性格特点：善于沟通、推动标准落地。榜样点：让设备“说同一种语言”，世界才能互联。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-069' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '奥沙利文（John O''Sullivan）', `profile` = '澳大利亚工程师、天文学家（1954年生），把处理射电天文数据的信号技术变成Wi-Fi核心专利，带领CSIRO团队发明现代Wi-Fi。性格特点：跨界思维、从星空到芯片。榜样点：研究星空的工具，也能造福千家万户。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-070' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '哈特森（Jaap Haartsen）', `profile` = '荷兰工程师（1963年生），1994年在爱立信发明蓝牙短距离无线通信技术。性格特点：沉稳专注、耐得住长期研发。榜样点：设备间“握手”的距离，也需要了不起的发明。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-071' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '考克斯（Donald Cox）', `profile` = '美国工程师（1937年生），建立移动信道统计模型，为蜂窝无线电系统设计奠定理论基础。性格特点：理论联系实际、锲而不舍。榜样点：把看不见的电波“走廊”研究透，信号才更稳。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-072' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '克拉克（Arthur C. Clarke）', `profile` = '英国科幻作家、未来学家（1917—2008），1945年提出地球静止轨道通信卫星构想，成为卫星通信起点。性格特点：想象力丰富、理性与诗意并存。榜样点：科幻作家的一篇短文，也能变成人类的蓝图。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-073' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '皮尔斯（John R. Pierce）', `profile` = '美国工程师（1910—2002），主持贝尔实验室通信卫星项目，参与研制世界上第一颗有源通信卫星Telstar，1979年获马可尼奖。性格特点：学识广博、幽默睿智。榜样点：把科学幻想变成工程现实，靠扎实的技术。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-074' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '罗森（Harold Rosen）', `profile` = '美国工程师（1926—2020），主持研制地球静止轨道同步通信卫星Syncom，让“同步卫星”首次稳定工作。性格特点：目标坚定、敢于简化。榜样点：敢于选择最难也最对的路。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-075' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '帕金森（Bradford Parkinson）', `profile` = '美国工程师（1935年生），领导全球定位系统（GPS）方案设计，被称为“GPS之父”。性格特点：条理清晰、善于统筹。榜样点：头顶的“星网”，让全球共享精准定位。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-076' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '拉马（Hedy Lamarr）', `profile` = '奥地利裔美国影星、发明家（1914—2000），1942年与安泰尔共同申请跳频通信专利，成为Wi-Fi、蓝牙与CDMA的技术基础。性格特点：才华横溢、不拘一格。榜样点：智慧与美貌从不冲突，创造力不分行业。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-077' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '安泰尔（George Antheil）', `profile` = '美国作曲家、发明家（1900—1959），与拉马合作设计“跳频秘密通信系统”并获专利。性格特点：跨界创意、敢想敢做。榜样点：音乐家的节奏感，也能变成防干扰的密码。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-078' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '德雷克（Frank Drake）', `profile` = '美国天文学家（1930—2022），开创搜寻地外文明（SETI）计划，提出“德雷克方程”，率先用射电望远镜“倾听”宇宙。性格特点：好奇心旺盛、胸怀宇宙。榜样点：仰望星空并认真聆听，是人类最浪漫的科学。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-079' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '央斯基（Karl Jansky）', `profile` = '美国工程师（1905—1950），1933年在贝尔实验室研究无线电干扰时发现来自银河系的射电信号，开创射电天文学。性格特点：细心观察、不放过“杂音”。榜样点：别人眼里的干扰，可能是宇宙的问候。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-080' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '雷伯（Grote Reber）', `profile` = '美国业余无线电爱好者、天文学家（1911—2002），用自制抛物面天线绘制银河射电图，确认了央斯基的发现。性格特点：自费研究、乐在其中。榜样点：爱好，也能撑起一座“后院天文台”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-081' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '洛弗尔（Bernard Lovell）', `profile` = '英国物理学家（1913—2012），主持建造焦德雷尔班克76米射电望远镜，长期用于雷达与深空通信研究。性格特点：坚韧执着、敢立大目标。榜样点：敢想大目标，也要一步步把大天线立起来。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-082' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '赖尔（Martin Ryle）', `profile` = '英国天文学家（1918—1984），发明综合孔径射电望远镜，大幅提高射电图像分辨率，1974年获诺贝尔物理学奖。性格特点：严谨高效、善于创新方法。榜样点：方法创新，让“看得更远”成为可能。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-083' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '休伊什（Antony Hewish）', `profile` = '英国天文学家（1924—2021），参与发现脉冲星并领导射电巡天阵列建设，1974年获诺贝尔物理学奖。性格特点：认真细致、耐得大量数据。榜样点：耐心整理数据的人，才能听见宇宙的脉搏。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-084' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '贝尔·伯内尔（Jocelyn Bell Burnell）', `profile` = '英国天体物理学家（1943年生），1967年发现第一颗脉冲星，后投身科学教育与科普。性格特点：坚韧谦逊、乐于提携后辈。榜样点：勤恳的年轻人，也能做出载入史册的发现。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-085' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '泰勒（Joseph Hooton Taylor Jr.）', `profile` = '美国天体物理学家（1941年生），呼号K1JT，因发现脉冲双星验证引力波辐射获1993年诺贝尔物理学奖，并开发业余无线电数字通信软件WSJT。性格特点：严谨又爱玩、学术与爱好兼得。榜样点：业余爱好和科学研究，可以彼此成就。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-086' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '马克西姆（Hiram Percy Maxim）', `profile` = '美国工程师（1869—1936），创办美国无线电中继联盟（ARRL）并推动业余电台标准化，是现代业余无线电运动奠基人。性格特点：组织力强、热心公益。榜样点：把爱好者组织起来，爱好就有更大的力量。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-087' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '加里奥特（Owen Garriott）', `profile` = '美国宇航员、工程师（1930—2019），呼号W5LFL，1983年成为首位在太空进行业余无线电通信的人，让太空与地面学生直接对话。性格特点：乐观勇敢、乐于分享。榜样点：把爱好带上太空，星空就离我们更近。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-088' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '克罗恩凯特（Walter Cronkite）', `profile` = '美国电视新闻主播（1916—2009），呼号KB2GSD，长期报道科学、航天与重大事件，被称为“美国最受信任的人”。性格特点：沉着可信、敬业正直。榜样点：让人信任的传播者，首先自己相信真相。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-089' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '戈德华特（Barry Goldwater）', `profile` = '美国政治家（1909—1998），呼号K7UGA，终身热爱业余无线电并积极推动公众通信与应急通信。性格特点：直率坦诚、服务公众。榜样点：无论做什么职业，都可以为爱好与社区出力。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-090' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '侯赛因（Hussein bin Talal）', `profile` = '约旦国王（1935—1999），呼号JY1，毕生活跃于业余无线电；2018年升空的约旦首颗业余卫星JY1SAT以他的呼号命名。性格特点：勤勉好学、平易近人。榜样点：身份再高，也要保持对世界的好奇。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-091' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '柏林纳（Emile Berliner）', `profile` = '德裔美国发明家（1851—1929），发明碳粒麦克风与留声机唱片，改进电话与声音记录技术。性格特点：实干创新、关心公共健康。榜样点：让声音被“听见”，世界就小了一圈。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-092' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '波尔森（Valdemar Poulsen）', `profile` = '丹麦工程师（1869—1942），发明电弧发射机实现连续波无线电报，并发明钢丝录音机。性格特点：勤于试验、敢为人先。榜样点：连续稳定的信号，来自一次次改进。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-093' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '特曼（Frederick Terman）', `profile` = '美国电子工程师、教育家（1900—1982），著《无线电工程》经典教材，在斯坦福推动产学研结合，被誉为“硅谷之父”，1950年获IEEE荣誉奖章。性格特点：诲人不倦、眼光长远。榜样点：大学与企业手拉手，科技才能跑得快。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-094' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '王诤（1909—1978）', `profile` = '江苏武进人，开国中将。1930年携“半部电台”参加红军，创建中央苏区和我军无线电通信与侦察，被誉为我军通信“开山鼻祖”，后领导新中国电子工业。性格特点：临危受命、坚韧务实。榜样点：即使只有“半部电台”，也能开启一番事业。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-095' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '李强（1905—1996）', `profile` = '江苏常熟人，中国科学院院士。1929年研制出中共第一部地下无线电收发报机，后任首任广播事业局局长、邮电部门负责人。性格特点：隐蔽战线上的实干家、多才多艺。榜样点：技术，可以成为照亮黑夜的火种。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-096' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '张沈川（1900—1991）', `profile` = '湖南慈利人。1929年成为中共第一位无线电报务员，编制早期无线电密码，并参与开办最早的无线电训练班培养报务员。性格特点：机智勇敢、严守纪律。榜样点：学好一门硬本领，关键时刻就能派上用场。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-097' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '涂作潮（1902—1984）', `profile` = '湖南长沙人，代号“木匠”。中共最早的电台修理专家，以修理公司为掩护维护秘密电台，亲手培养电影《永不消逝的电波》中主角原型的报务员。性格特点：心灵手巧、甘当无名英雄。榜样点：把平凡手艺做到极致，就是不凡的贡献。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-098' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '陈芳允（1916—2000）', `profile` = '浙江台州人，中国科学院院士、“两弹一星”功勋奖章获得者。中国卫星测控技术奠基人，提出“双星定位”构想，为北斗导航系统奠定基础。性格特点：仰望星空、脚踏实地。榜样点：从测控一颗卫星，到指引北斗群星。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-099' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '孙俊人（1915—2001）', `profile` = '上海松江人，中国工程院院士、少将。1938年赴延安组建通信工厂研制军用通信设备，1952年组建解放军通信工程学院，一生献给军事通信。性格特点：以身许国、甘为人梯。榜样点：让战士“耳聪目明”，是通信人的荣光。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-100' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '毕德显（1908—1992）', `profile` = '山东平阴人，中国科学院院士。中国雷达工程专业主要创始人，最早把信息论用于雷达与通信研究，毕生教书育人。性格特点：治学严谨、淡泊名利。榜样点：创立一门专业，可以带出一整支队伍。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-101' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '罗沛霖（1913—2011）', `profile` = '天津人，中国科学院、中国工程院院士。被称为“战士、博士、院士”的“三士科学家”，是中国电子信息产业的开拓者与奠基人之一。性格特点：经历传奇、永不停步。榜样点：无论环境多艰苦，学习与报国都要坚持。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-102' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '孟昭英（1906—1995）', `profile` = '河北乐亭人，中国科学院院士、清华大学教授。二战期间发明小型“花生管”电子管，推动电子管技术发展，培养大批无线电人才。性格特点：动手能力极强、诲人不倦。榜样点：小小电子管，也能登上世界发明舞台。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-103' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '张煦（1913—2015）', `profile` = '江苏无锡人，中国科学院院士。中国通信界元勋、光纤通信奠基人之一，从教60余年始终站在通信科技前沿。性格特点：终身学习、甘坐冷板凳。榜样点：学习真的可以是一辈子的事。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-104' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '朱物华（1902—1998）', `profile` = '江苏扬州人，中国科学院院士。无线电子学家、水声工程专家，长期在上海交通大学任教，为国家培养大批通信人才。性格特点：温厚严谨、重视基础。榜样点：扎实的基础，是任何尖端技术的根。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-105' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '冯秉铨（1910—1980）', `profile` = '河北安新人，电子学家、教育家。新中国无线电电子科学奠基者之一，华南工学院教务长，首创广东高校业余无线电台，“南冯北孟”之一。性格特点：德才兼备、甘于奉献。榜样点：办好教育，就是播下最远的“电波”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-106' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '林为干（1919—2015）', `profile` = '广东台山人，中国科学院院士，被誉为“中国微波之父”。系统研究微波理论与技术，著有多部经典专著，培养大批微波人才。性格特点：治学勤奋、著述宏富。榜样点：把一门学问做深做透，就能成为“之父”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-107' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '黄宏嘉（1924—2016）', `profile` = '湖南常德人，中国科学院院士。微波与光波导学家，提出“超模式”理论，是中国单模光纤技术开拓者之一。性格特点：基础扎实、善于理论创新。榜样点：从微波到光的跨越，靠的是扎实的数学物理功底。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-108' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '谢希德（1921—2000）', `profile` = '福建泉州人，中国科学院院士。中国半导体物理与表面物理学科开创者之一，新中国第一位大学女校长（复旦大学校长）。性格特点：坚韧自强、温和有力。榜样点：面对困难不屈不挠，女生同样可以领跑科学。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-109' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '黄昆（1919—2005）', `profile` = '北京人，中国科学院院士。世界著名固体物理学家、中国半导体物理奠基人之一，2001年获国家最高科学技术奖。性格特点：治学严格、淡泊专注。榜样点：把一门学问做到极致，就能撑起一个学科。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-110' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '王守武（1919—2014）', `profile` = '江苏苏州人，中国科学院院士。半导体器件物理学家，1958年筹建我国第一个晶体管工厂，是中国半导体事业的拓荒者。性格特点：敢为人先、百折不挠。榜样点：从零造出中国自己的晶体管，需要勇气更需要耐心。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-111' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '童志鹏（1924—2017）', `profile` = '浙江慈溪人，中国工程院院士。中国综合电子信息系统的开拓者和奠基人，主持通信电台、机载雷达与卫星无线电测控系统研制。性格特点：视野宏大、善于统筹。榜样点：把一个个系统联成网，才能守护国家安全。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-112' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '王越（1932年生）', `profile` = '江苏丹阳人，中国科学院、中国工程院院士。雷达与信息系统专家，曾任北京理工大学校长，长期从事雷达与火控系统研制。性格特点：严谨求实、躬身育人。榜样点：从雷达屏幕上的亮点，到保卫国门的“千里眼”。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-113' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '王小谟（1938—2023）', `profile` = '北京人，中国工程院院士。中国预警机事业开拓者和奠基人，主持研制空警2000、空警200，2012年获国家最高科学技术奖。性格特点：坚毅执着、敢啃硬骨头。榜样点：让中国预警机看得更远，是几代人的接力。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-114' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '刘永坦（1936年生）', `profile` = '江苏南京人，中国科学院、中国工程院院士。对海探测新体制雷达理论与技术奠基人，带领团队为祖国筑起“海防长城”，2018年获国家最高科学技术奖。性格特点：数十年专注一件事、甘坐冷板凳。榜样点：一辈子做好一件事，就是了不起的人生。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-115' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '叶叔华（1927年生）', `profile` = '广东广州人，中国科学院院士。中国天文界第一位女台长（上海天文台），建立中国综合世界时系统，推动甚长基线干涉测量（VLBI）落地。性格特点：敢闯敢拼、大气豪爽。榜样点：让“北京时间”准起来，她奋斗了一辈子。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-116' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '谭述森（1942年生）', `profile` = '重庆开县人，中国工程院院士。北斗卫星导航系统主要开拓者和建设者之一，52岁从雷达领域转向卫星导航拓荒。性格特点：永不服输、老当益壮。榜样点：什么时候开始新事业都不算晚。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-117' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '孙家栋（1929年生）', `profile` = '辽宁复县人，中国科学院院士。中国人造卫星技术开创者之一，担任北斗导航系统工程总设计师，1999年获“两弹一星”功勋奖章，2009年获国家最高科学技术奖。性格特点：举重若轻、敢于担当。榜样点：把一颗颗卫星送上太空，靠的是严谨与胆识。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-118' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '王绶琯（1923—2021）', `profile` = '福建福州人，中国科学院院士。中国射电天文学开创者，主持研制多型射电天文设备，晚年创办北京青少年科技俱乐部，推动“大手拉小手”。性格特点：高瞻远瞩、关爱后辈。榜样点：仰望星空的人，最懂得托举未来。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-119' AND `name` LIKE '无线电贡献者 %';

UPDATE `RadioPerson`
SET `name` = '南仁东（1945—2017）', `profile` = '吉林辽源人。FAST“中国天眼”首席科学家、总工程师，二十余年主持建成世界最大的500米口径球面射电望远镜，获“人民科学家”国家荣誉称号。性格特点：敢想敢干、以身许国。榜样点：把一件事做到世界第一，就是给国家的回答。', `updatedAt` = CURRENT_TIMESTAMP(3)
WHERE `id` = 'radio-person-120' AND `name` LIKE '无线电贡献者 %';
