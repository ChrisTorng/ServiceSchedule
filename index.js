let encryptionPassword = '';

async function input(message) {
    return new Promise((resolve) => {
        const result = prompt(message);
        resolve(result);
    });
}

async function fetchEncrypted(url) {
    const encryptedUrl = `${url}.encrypted`;
    const response = await fetch(encryptedUrl);
    const encryptedText = await response.text();

    // 解密
    const decryptedText = decryptText(encryptedText, encryptionPassword);

    return {
        text: () => Promise.resolve(decryptedText),
        json: () => Promise.resolve(JSON.parse(decryptedText))
    };
}

function decryptText(encryptedText, password) {
    // 解析 JSON
    const encryptedObj = JSON.parse(encryptedText);
    const ciphertext = CryptoJS.enc.Base64.parse(encryptedObj.ct);

    // 從密碼生成金鑰
    const key = CryptoJS.enc.Utf8.parse(password.repeat(Math.ceil(32 / password.length)).slice(0, 32));

    // 提取 IV（前 16 字節）和實際的加密數據
    const iv = ciphertext.clone();
    iv.sigBytes = 16;
    iv.clamp();
    ciphertext.words.splice(0, 4); // remove IV from ciphertext
    ciphertext.sigBytes -= 16;

    // 解密
    const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: ciphertext },
        key,
        { iv: iv }
    );

    // 轉換為 UTF-8 字符串
    return decrypted.toString(CryptoJS.enc.Utf8);
}

function fetchLocal(id) {
    return new Promise((resolve, reject) => {
        const element = document.getElementById(id);
        if (element) {
            const content = element.textContent.trim();
            const response = {
                text: () => Promise.resolve(content),
                json: () => Promise.resolve(JSON.parse(content))
            };
            resolve(response);
        } else {
            reject(new Error(`Element with id '${id}' not found`));
        }
    });
}

document.addEventListener('DOMContentLoaded', async function () {
    // 一開始就詢問密碼
    encryptionPassword = await input('請輸入解密密碼：');

    // 獲取當前日期
    const currentDate = new Date();
    
    // 計算本週日的日期
    const thisWeekSunday = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - currentDate.getDay() + (currentDate.getDay() == 0 ? 0 : 7));
    const formattedSunday = `${thisWeekSunday.getMonth() + 1}/${thisWeekSunday.getDate()}`;
    const table = document.getElementById('serviceTable');
    const select = document.getElementById('nameSelect');
    let serviceData;
    let namesList = [];

    // 定義服事名稱對應表
    const serviceNameMap = {
        'prayer': '會前禱告',
        'speaker': '講員',
        'worship': '敬拜主領',
        'vocal': '敬拜Vocal',
        'projection': '投影',
        'announcements': '報告消息',
        'communion': '擘餅',
        'offering': '招待奉獻',
        'soundSystem': '總音',
        'livestream': '架設直播',
        'childrenTeacher': '兒主老師',
        'piano': '鋼琴',
        'guitar': '吉他',
        'drum': '鼓',
        'bass': '貝斯',
        'keyboard': 'KB'
    };

    // 讀取 Names.txt 檔案
    fetchEncrypted('names.txt')
        .then(response => response.text())
        .then(data => {
            namesList = data.split(/\r?\n/).map(name => name.trim()).filter(name => name.trim() !== '');
            console.log('Names loaded:', namesList);
        })
        .catch(error => console.error('Error loading names:', error));

    // 計算每個人的服事次數
    function calculateServiceCounts(data) {
        const counts = {};
        data.forEach(service => {
            Object.entries(service).forEach(([key, value]) => {
                if (typeof value === 'string' && value.trim() !== '') {
                    if (!counts[value]) counts[value] = {};
                    counts[value][key] = (counts[value][key] || 0) + 1;
                } else if (Array.isArray(value)) {
                    value.forEach(name => {
                        if (name.trim() !== '') {
                            if (!counts[name]) counts[name] = {};
                            counts[name][key] = (counts[name][key] || 0) + 1;
                        }
                    });
                } else if (typeof value === 'object' && value !== null) {
                    Object.entries(value).forEach(([instrument, name]) => {
                        if (name.trim() !== '') {
                            if (!counts[name]) counts[name] = {};
                            counts[name][instrument] = (counts[name][instrument] || 0) + 1;
                        }
                    });
                }
            });
        });
        return counts;
    }

    // 從 serviceData.json 讀取服事表數據
    fetchEncrypted('serviceData.json')
        .then(response => response.json())
        .then(data => {
            serviceData = data.services;
            const serviceCounts = calculateServiceCounts(serviceData);
            populateTable(serviceData);
            populateSelect(serviceCounts);
            console.log('Service data loaded:', serviceData);
        })
        .catch(error => console.error('Error loading service data:', error));

    // 填充下拉選單
    function populateSelect(counts) {
        const serviceOrder = ['prayer', 'speaker', 'worship', 'vocal', 'projection', 'piano', 'guitar', 'drum', 'bass', 'keyboard', 'announcements', 'communion', 'offering', 'soundSystem', 'livestream', 'childrenTeacher'];
        namesList.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            if (counts[name]) {
                const serviceText = serviceOrder
                    .filter(service => counts[name][service])
                    .map(service => {
                        const chineseName = serviceNameMap[service] || service;
                        return `${chineseName}:${counts[name][service]}`;
                    })
                    .join('; ');
                option.textContent = `${name} ${serviceText}`;
            } else {
                option.textContent = name;
            }
            select.appendChild(option);
        });
    }

    // 填充表格
    function populateTable(data) {
        const tbody = table.querySelector('tbody');
        tbody.innerHTML = ''; // 清空現有的表格內容

        data.forEach(service => {
            const row = document.createElement('tr');

            // 檢查是否為本週主日
            if (service.date === formattedSunday) {
                row.classList.add('highlight');
            }

            if (service.allDay) {
                // 對於全天事項，合併所有列
                const cell = document.createElement('td');
                cell.textContent = `${service.date} - ${service.type}`;
                cell.colSpan = 14;
                cell.style.textAlign = 'left';
                row.appendChild(cell);
            } else if (service.specialEvent) {
                // 對於特殊事項，合併部分列
                const dateCell = document.createElement('td');
                dateCell.textContent = service.date;
                row.appendChild(dateCell);

                const typeCell = document.createElement('td');
                typeCell.textContent = service.type;
                typeCell.className = 'align-left';
                row.appendChild(typeCell);

                const prayerCell = document.createElement('td');
                prayerCell.textContent = service.prayer;
                row.appendChild(prayerCell);

                const speakerCell = document.createElement('td');
                speakerCell.textContent = service.speaker;
                row.appendChild(speakerCell);

                const specialEventCell = document.createElement('td');
                specialEventCell.textContent = service.specialEvent;
                specialEventCell.colSpan = 10;
                specialEventCell.style.textAlign = 'left';
                row.appendChild(specialEventCell);
            } else {
                // 對於正常的服事項目
                const fields = ['date', 'type', 'prayer', 'speaker', 'worship', 'vocal', 'projection', 'band', 'announcements', 'communion', 'offering', 'soundSystem', 'livestream', 'childrenTeacher'];
                fields.forEach(field => {
                    const cell = document.createElement('td');
                    if (field === 'band') {
                        // 處理樂團資訊
                        const bandInfo = [];
                        if (service.band.piano) bandInfo.push(`琴:${service.band.piano}`);
                        if (service.band.guitar) bandInfo.push(`吉:${service.band.guitar}`);
                        if (service.band.drum) bandInfo.push(`鼓:${service.band.drum}`);
                        if (service.band.bass) bandInfo.push(`斯:${service.band.bass}`);
                        if (service.band.keyboard) bandInfo.push(`KB:${service.band.keyboard}`);
                        cell.textContent = bandInfo.join('/');
                    } else if (Array.isArray(service[field])) {
                        // 處理敬拜主領、敬拜Vocal和擘餅
                        cell.textContent = service[field].join('&');
                    } else {
                        cell.textContent = service[field] || '';
                    }
                    if (field === 'type' || field === 'band') {
                        cell.className = 'align-left';
                    }
                    row.appendChild(cell);
                });
            }

            tbody.appendChild(row);
        });
    }

    // 清除所有高亮顯示
    function clearAllHighlights() {
        table.querySelectorAll('td').forEach(cell => {
            cell.classList.remove('highlight');
            cell.innerHTML = cell.innerHTML.replace(/<span class="highlight-text">(.+?)<\/span>/g, "$1");
        });
    }

    // 選擇人名時突出顯示
    select.addEventListener('change', function() {
        const selectedName = this.value;
        console.log('Selected name:', selectedName);

        clearAllHighlights();

        if (selectedName) {
            let highlightCount = 0;

            table.querySelectorAll('td').forEach(cell => {
                if (cell.textContent.includes(selectedName)) {
                    cell.classList.add('highlight');
                    cell.innerHTML = cell.innerHTML.replace(
                        new RegExp(`(${selectedName})`, 'g'), 
                        '<span class="highlight-text">$1</span>'
                    );
                    highlightCount++;
                }
            });

            console.log('Cells highlighted:', highlightCount);
        }
    });
});