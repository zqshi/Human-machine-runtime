import {
  isNaturalCreateIntent,
  isNaturalRagIntent,
  extractEmployeeName,
  inferJobTitle,
  toJobCode,
  defaultEmployeeName,
  normalizeLocalpart,
  buildCreatorProfile,
} from './matrix-bot-nlu.js';

describe('isNaturalCreateIntent', () => {
  it('中文:创建+数字员工 命中', () => {
    expect(isNaturalCreateIntent('帮我创建一个数字员工')).toBe(true);
    expect(isNaturalCreateIntent('新建一个数字员工')).toBe(true);
    expect(isNaturalCreateIntent('生成一个数字员工')).toBe(true);
  });

  it('中文:创建+agent/机器人/bot 命中', () => {
    expect(isNaturalCreateIntent('创建一个 agent')).toBe(true);
    expect(isNaturalCreateIntent('新建机器人')).toBe(true);
    expect(isNaturalCreateIntent('生成一个 bot')).toBe(true);
  });

  it('英文 create an agent 命中', () => {
    expect(isNaturalCreateIntent('create an agent')).toBe(true);
    expect(isNaturalCreateIntent('Create a digital agent')).toBe(true);
    expect(isNaturalCreateIntent('please create a bot')).toBe(true);
  });

  it('负面:空串返回 false', () => {
    expect(isNaturalCreateIntent('')).toBe(false);
    expect(isNaturalCreateIntent('   ')).toBe(false);
  });

  it('负面:无关文本', () => {
    expect(isNaturalCreateIntent('今天天气不错')).toBe(false);
    expect(isNaturalCreateIntent('帮我查一下文档')).toBe(false);
    expect(isNaturalCreateIntent('create')).toBe(false);
  });

  it('负面:只有动作词没有目标词', () => {
    expect(isNaturalCreateIntent('创建')).toBe(false);
    expect(isNaturalCreateIntent('生成一份报告')).toBe(false);
  });

  it('大小写不敏感', () => {
    expect(isNaturalCreateIntent('CREATE AN AGENT')).toBe(true);
    expect(isNaturalCreateIntent('创建 AGENT')).toBe(true);
  });
});

describe('isNaturalRagIntent', () => {
  it('动作词×目标词组合命中(长度 >= 6)', () => {
    expect(isNaturalRagIntent('帮我查一下知识库')).toBe(true);
    expect(isNaturalRagIntent('查一下流程文档')).toBe(true);
    expect(isNaturalRagIntent('搜索一下资料')).toBe(true);
    expect(isNaturalRagIntent('找一下流程规范')).toBe(true);
    expect(isNaturalRagIntent('检索一下报告')).toBe(true);
    expect(isNaturalRagIntent('帮我查一下方案')).toBe(true);
  });

  it('长度 < 6 拒绝(无论是否含关键词)', () => {
    // 注意:源码先做 raw.length < 6 短路,即使含动作+目标词也拒绝
    expect(isNaturalRagIntent('')).toBe(false);
    expect(isNaturalRagIntent('查')).toBe(false);
    expect(isNaturalRagIntent('检索')).toBe(false);
    expect(isNaturalRagIntent('找一下规范')).toBe(false); // 5 字符,含关键词但被长度门限拒绝
  });

  it('负面:有动作词但无目标词', () => {
    expect(isNaturalRagIntent('帮我查一下天气情况吧')).toBe(false);
    expect(isNaturalRagIntent('搜索一下新闻')).toBe(false);
  });

  it('负面:有目标词但无动作词', () => {
    expect(isNaturalRagIntent('这是知识库的内容')).toBe(false);
    expect(isNaturalRagIntent('流程文档在这里')).toBe(false);
  });

  it('负面:无关文本', () => {
    expect(isNaturalRagIntent('你好')).toBe(false);
    expect(isNaturalRagIntent('abc')).toBe(false);
  });

  it('仅动作词无目标且长度足够仍返回 false', () => {
    expect(isNaturalRagIntent('帮我查一下')).toBe(false);
  });
});

describe('extractEmployeeName', () => {
  it('中文 叫/名为/名字是 模式', () => {
    expect(extractEmployeeName('创建一个数字员工,叫小明')).toBe('小明');
    expect(extractEmployeeName('新建数字员工 名为张三')).toBe('张三');
    expect(extractEmployeeName('生成数字员工 名字是李四')).toBe('李四');
  });

  it('中文带引号', () => {
    expect(extractEmployeeName('创建数字员工 叫"小明"')).toBe('小明');
    expect(extractEmployeeName('创建数字员工 叫"小明"')).toBe('小明');
  });

  it('英文 named 模式', () => {
    expect(extractEmployeeName('create an agent named Alice')).toBe('Alice');
    expect(extractEmployeeName('new agent named Bob')).toBe('Bob');
    expect(extractEmployeeName('create agent "Carol"')).toBe('Carol');
  });

  it('无匹配返回空串', () => {
    expect(extractEmployeeName('创建一个数字员工')).toBe('');
    expect(extractEmployeeName('')).toBe('');
    expect(extractEmployeeName('随便说点什么')).toBe('');
  });

  it('名称过短(<2 字符)不匹配', () => {
    expect(extractEmployeeName('叫a')).toBe('');
  });
});

describe('inferJobTitle', () => {
  it('各岗位关键词映射', () => {
    expect(inferJobTitle('一个采购数字员工')).toBe('采购专员');
    expect(inferJobTitle('财务数字员工')).toBe('财务专员');
    expect(inferJobTitle('法务数字员工')).toBe('法务专员');
    expect(inferJobTitle('人事数字员工')).toBe('人事专员');
    expect(inferJobTitle('HR 数字员工')).toBe('人事专员');
    expect(inferJobTitle('运维数字员工')).toBe('运维工程师');
    expect(inferJobTitle('开发数字员工')).toBe('开发工程师');
    expect(inferJobTitle('engineer 数字员工')).toBe('开发工程师');
    expect(inferJobTitle('测试数字员工')).toBe('测试工程师');
    expect(inferJobTitle('QA 数字员工')).toBe('测试工程师');
    expect(inferJobTitle('产品数字员工')).toBe('产品经理');
    expect(inferJobTitle('运营数字员工')).toBe('运营专员');
    expect(inferJobTitle('销售数字员工')).toBe('销售专员');
  });

  it('大小写不敏感', () => {
    expect(inferJobTitle('hr 数字员工')).toBe('人事专员');
    expect(inferJobTitle('qa 工程师')).toBe('测试工程师');
    expect(inferJobTitle('ENGINEER')).toBe('开发工程师');
  });

  it('无匹配返回默认"通用岗位"', () => {
    expect(inferJobTitle('创建一个数字员工')).toBe('通用岗位');
    expect(inferJobTitle('')).toBe('通用岗位');
    expect(inferJobTitle('随便文本')).toBe('通用岗位');
  });
});

describe('toJobCode', () => {
  it('各岗位 -> code', () => {
    expect(toJobCode('采购专员')).toBe('procurement');
    expect(toJobCode('财务专员')).toBe('finance');
    expect(toJobCode('法务专员')).toBe('legal');
    expect(toJobCode('人事专员')).toBe('hr');
    expect(toJobCode('运维工程师')).toBe('ops');
    expect(toJobCode('开发工程师')).toBe('dev');
    expect(toJobCode('测试工程师')).toBe('qa');
    expect(toJobCode('产品经理')).toBe('pm');
    expect(toJobCode('运营专员')).toBe('ops');
    expect(toJobCode('销售专员')).toBe('sales');
  });

  it('无匹配返回 general', () => {
    expect(toJobCode('通用岗位')).toBe('general');
    expect(toJobCode('')).toBe('general');
    expect(toJobCode('未知岗位')).toBe('general');
  });
});

describe('defaultEmployeeName', () => {
  it('有岗位推断 -> "{岗位}数字员工"', () => {
    expect(defaultEmployeeName('创建一个采购数字员工')).toBe('采购专员数字员工');
    expect(defaultEmployeeName('新建开发数字员工')).toBe('开发工程师数字员工');
    expect(defaultEmployeeName('生成 HR 数字员工')).toBe('人事专员数字员工');
  });

  it('无岗位推断 -> "数字员工-{6位}" 正则', () => {
    expect(defaultEmployeeName('创建一个数字员工')).toMatch(/^数字员工-\d{6}$/);
    expect(defaultEmployeeName('create an agent')).toMatch(/^数字员工-\d{6}$/);
    expect(defaultEmployeeName('随便文本')).toMatch(/^数字员工-\d{6}$/);
  });

  it('6 位是纯数字', () => {
    const name = defaultEmployeeName('随便文本');
    const digits = name.split('-')[1];
    expect(digits).toMatch(/^\d{6}$/);
  });
});

describe('normalizeLocalpart', () => {
  it('带 @ 前缀去除', () => {
    expect(normalizeLocalpart('@alice:home_server')).toBe('alice');
    expect(normalizeLocalpart('alice:home_server')).toBe('alice');
  });

  it('带 :home_server 截断', () => {
    expect(normalizeLocalpart('@bob:example.com')).toBe('bob');
    expect(normalizeLocalpart('@bob:matrix.local')).toBe('bob');
  });

  it('无 @ 无 : 原样保留(合法字符)', () => {
    expect(normalizeLocalpart('carol')).toBe('carol');
    expect(normalizeLocalpart('user.name_123')).toBe('user.name_123');
    expect(normalizeLocalpart('a-b.c_d')).toBe('a-b.c_d');
  });

  it('非法字符过滤', () => {
    expect(normalizeLocalpart('@café:home')).toBe('caf');
    expect(normalizeLocalpart('hel lo')).toBe('hello');
    expect(normalizeLocalpart('user@name')).toBe('username');
    expect(normalizeLocalpart('测试用户:home')).toBe('');
  });

  it('长度 > 64 截断为 64', () => {
    const long = 'a'.repeat(100);
    const result = normalizeLocalpart(long);
    expect(result.length).toBe(64);
    expect(result).toBe('a'.repeat(64));
  });

  it('刚好 64 字符不截断', () => {
    const exact = 'b'.repeat(64);
    expect(normalizeLocalpart(exact)).toBe(exact);
  });
});

describe('buildCreatorProfile', () => {
  it('resolveIdentityProfile 为 null -> fallback', async () => {
    const profile = await buildCreatorProfile(null, '@alice:home', {});
    expect(profile.email).toBe('alice@digital-employee.local');
    expect(profile.jobTitle).toBe('通用岗位');
    expect(profile.jobCode).toBe('general');
    expect(profile.department).toBe('general');
  });

  it('resolveIdentityProfile 为 null 且带 intent.jobTitle -> fallback 用该岗位', async () => {
    const profile = await buildCreatorProfile(null, '@alice:home', { jobTitle: '财务专员' });
    expect(profile.jobTitle).toBe('财务专员');
    expect(profile.jobCode).toBe('finance');
    expect(profile.department).toBe('finance');
  });

  it('resolveIdentityProfile 返回 null -> fallback', async () => {
    const resolver = vi.fn(async () => null);
    const profile = await buildCreatorProfile(resolver, '@bob:home', {});
    expect(resolver).toHaveBeenCalledWith('@bob:home');
    expect(profile.email).toBe('bob@digital-employee.local');
    expect(profile.jobTitle).toBe('通用岗位');
  });

  it('resolveIdentityProfile 返回 partial -> merge 且 trim', async () => {
    const resolver = vi.fn(async () => ({
      email: '  zhang@corp.com  ',
      jobTitle: '  开发工程师  ',
      employeeNo: ' E001 ',
      enterpriseUserId: '  uid-9  ',
    }));
    const profile = await buildCreatorProfile(resolver, '@carol:home', {});
    expect(profile.email).toBe('zhang@corp.com');
    expect(profile.jobTitle).toBe('开发工程师');
    // 注意源码:jobCode/department 来自入口 intent(此处为空→通用岗位→general),
    // resolved 未提供这两个字段故不被覆盖
    expect(profile.jobCode).toBe('general');
    expect(profile.department).toBe('general');
    expect(profile.employeeNo).toBe('E001');
    expect(profile.enterpriseUserId).toBe('uid-9');
  });

  it('partial 同时提供 jobCode/department -> 完全覆盖', async () => {
    const resolver = vi.fn(async () => ({
      email: 'z@corp.com',
      jobTitle: '开发工程师',
      jobCode: '  dev  ',
      department: '  rd  ',
    }));
    const profile = await buildCreatorProfile(resolver, '@c:h', {});
    expect(profile.jobCode).toBe('dev');
    expect(profile.department).toBe('rd');
  });

  it('partial 未提供 jobTitle -> fallback 兜底 + trim', async () => {
    const resolver = vi.fn(async () => ({ email: 'x@y.com' }));
    const profile = await buildCreatorProfile(resolver, '@d:home', { jobTitle: '采购专员' });
    expect(profile.email).toBe('x@y.com');
    expect(profile.jobTitle).toBe('采购专员');
    expect(profile.jobCode).toBe('procurement');
    expect(profile.department).toBe('procurement');
  });

  it('resolveIdentityProfile 抛错 -> fallback', async () => {
    const resolver = vi.fn(async () => {
      throw new Error('identity down');
    });
    const profile = await buildCreatorProfile(resolver, '@err:home', {});
    expect(profile.email).toBe('err@digital-employee.local');
    expect(profile.jobTitle).toBe('通用岗位');
    expect(profile.jobCode).toBe('general');
  });

  it('sender 为空 -> localpart fallback 为 "employee"', async () => {
    const profile = await buildCreatorProfile(null, '', {});
    expect(profile.email).toBe('employee@digital-employee.local');
  });

  it('部门推断:法务 -> legal', async () => {
    const profile = await buildCreatorProfile(null, '@x:h', { jobTitle: '法务专员' });
    expect(profile.department).toBe('legal');
  });

  it('部门推断:默认 -> general', async () => {
    const profile = await buildCreatorProfile(null, '@x:h', { jobTitle: '产品经理' });
    expect(profile.department).toBe('general');
  });
});
