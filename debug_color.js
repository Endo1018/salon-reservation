
function getStaffColor(name) {
    const colors = [
        'bg-pink-500', 'bg-purple-500', 'bg-indigo-500', 'bg-blue-500',
        'bg-cyan-500', 'bg-teal-500', 'bg-emerald-500', 'bg-green-500',
        'bg-lime-500', 'bg-orange-500', 'bg-rose-500'
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    console.log(`Name: ${name}, Hash: ${hash}, Index: ${index}, Color: ${colors[index]}`);
}

getStaffColor('CHI');
getStaffColor('Chi');
