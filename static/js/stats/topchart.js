import $ from 'jquery';
import _ from 'underscore';
import Highcharts from 'highcharts';
import { normalizeRange } from './dateutils';
import { template } from '../lib/format';
import { StatsManager } from './manager';

var baseConfig = {
  chart: {
    backgroundColor: null,
  },
  title: {
    text: null,
  },
  plotArea: {
    shadow: null,
    borderWidth: null,
  },
  tooltip: {
    enabled: false,
  },
  plotOptions: {
    pie: {
      allowPointSelect: false,
      dataLabels: {
        enabled: false,
        color: '#333',
      },
      animation: false,
      size: 190,
    },
  },
  credits: { enabled: false },
  legend: {
    enabled: false,
  },
  series: [
    {
      type: 'pie',
    },
  ],
};

$.fn.topChart = function (cfg) {
  console.debug('topchart:init');
  $(this).each(function () {
    var $self = $(this),
      $win = $(window),
      $chart = $self.find('.piechart'),
      hChart,
      $table = $self.find('table'),
      metric = $table.attr('data-metric'),
      view = {
        metric: metric,
        group: 'all',
      };

    // reload the data when the view's range is modified.
    $win.on('changeview', function (e, newView) {
      console.debug('topchart:window:changeview', newView);
      // we only want to respond to changes in range.
      if (!newView.range) return;
      $self.addClass('loading');
      $self.removeClass('nodata');
      _.extend(view, { range: normalizeRange(newView.range) });
      $.when(StatsManager.getDataRange(view)).then(function (data) {
        generateRankedList(data, render);
      });
    });

    // We take the data (aggregated to one row)
    function generateRankedList(data, done) {
      if (data.empty) {
        $self.removeClass('loading');
        $self.addClass('nodata');
        if (hChart && hChart.destroy) hChart.destroy();
        $table.html('');
        return;
      }
      var totalValue = 0,
        otherValue = 0;
      data = data[data.firstIndex].data;
      if (_.isEmpty(data)) return;
      // Sum all fields.
      _.each(data, function (val) {
        totalValue += val;
      });
      // Convert all fields to percentages and prettify names.
      var rankedList = _.map(data, function (val, key) {
        var field = key.split('|').slice(-1)[0];
        return [
          StatsManager.getPrettyName(metric, field),
          val,
          (val / totalValue) * 100,
        ];
      });
      // Sort by value.
      rankedList = _.sortBy(rankedList, function (a) {
        return -a[1];
      });
      // Calculate the 'Other' percentage
      for (var i = 5; i < rankedList.length; i++) {
        otherValue += rankedList[i][1];
      }
      // Take the top 5 values and append an 'Other' row.
      rankedList = rankedList.slice(0, 5);
      rankedList.push([
        gettext('Other'),
        otherValue,
        (otherValue / totalValue) * 100,
      ]);
      // Move on with our lives.
      done(rankedList);
    }

    var tableRow = template(
      '<tr><td>{0}</td><td title="{3}">{1}</td><td>({2}%)</td></tr>',
    );

    function render(data) {
      var newBody = '<tbody>';
      _.each(data, function (row) {
        var title = row[0];
        var raw_value = row[1];
        var value = Highcharts.numberFormat(
          raw_value,
          raw_value < 10 ? 1 : 0,
        );
        var percent = Highcharts.numberFormat(row[2], 0);

        if (percent < 1) {
          percent = '<1';
        }

        newBody += tableRow([title, value, percent, raw_value]);
      });
      newBody += '</tbody>';
      $table.html(newBody);

      // set up chart.
      var newConfig = _.clone(baseConfig),
        row;
      newConfig.chart.renderTo = $chart[0];
      newConfig.series[0].data = _.map(data, function (r) {
        return r.slice(0, 2);
      });
      hChart = new Highcharts.Chart(newConfig);
      for (let i = 0; i < data.length; i++) {
        const row = $table.find('tr').eq(i);
        row
          .children()
          .eq(0)
          .append(
            $(
              "<b class='seriesdot' style='background:" +
                hChart.series[0].data[i].color +
                "'>&nbsp;</b>",
            ),
          );
      }
      $self.removeClass('loading');
    }
  });
};
